import { openDatabase, requestResult, transactionDone } from "@/lib/offline/idb";

export interface ApiCacheEntry<T = unknown> {
  key: string;
  userId: number;
  method: string;
  pathname: string;
  query: Record<string, string>;
  data: T;
  storedAt: number;
}

export type ApiCacheScope =
  | { type: "user"; userId: number }
  | { type: "deck-list"; userId: number }
  | { type: "deck"; userId: number; deckId: number }
  | { type: "stats"; userId: number; deckId?: number }
  | { type: "session"; userId: number; deckId: number; queueType?: "LEARN" | "REVIEW" }
  | { type: "all"; userId: number };

export type CacheQueryValue = string | number | boolean | null | undefined;

export function normalizeQuery(query?: Record<string, CacheQueryValue>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    normalized[key] = String(value);
  }
  return normalized;
}

export function apiCacheKey(
  userId: number | "guest",
  method: string,
  path: string,
  query?: Record<string, CacheQueryValue>,
): string {
  const url = new URL(path, "http://karisanki.local");
  const normalizedQuery = normalizeQuery({
    ...Object.fromEntries(url.searchParams.entries()),
    ...query,
  });
  const queryString = Object.keys(normalizedQuery)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(normalizedQuery[key])}`)
    .join("&");
  return [userId, method.toUpperCase(), url.pathname, queryString].filter(Boolean).join(":");
}

export function parseApiCacheEntry(entry: unknown): ApiCacheEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Partial<ApiCacheEntry>;
  if (
    typeof value.key !== "string" ||
    typeof value.userId !== "number" ||
    typeof value.method !== "string" ||
    typeof value.pathname !== "string" ||
    !value.query ||
    typeof value.query !== "object"
  ) {
    return null;
  }
  return value as ApiCacheEntry;
}

export async function readApiCache<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction("api-cache", "readonly");
    const entry = await requestResult(transaction.objectStore("api-cache").get(key));
    await transactionDone(transaction);
    const parsed = parseApiCacheEntry(entry);
    return parsed ? (parsed.data as T) : null;
  } catch {
    return null;
  }
}

export async function writeApiCache(
  key: string,
  userId: number,
  method: string,
  path: string,
  data: unknown,
  query?: Record<string, CacheQueryValue>,
): Promise<void> {
  try {
    const url = new URL(path, "http://karisanki.local");
    const db = await openDatabase();
    const transaction = db.transaction("api-cache", "readwrite");
    const entry: ApiCacheEntry = {
      key,
      userId,
      method: method.toUpperCase(),
      pathname: url.pathname,
      query: {
        ...normalizeQuery(Object.fromEntries(url.searchParams.entries())),
        ...normalizeQuery(query),
      },
      data,
      storedAt: Date.now(),
    };
    transaction.objectStore("api-cache").put(entry);
    await transactionDone(transaction);
  } catch {
    // Cache writes must not break page rendering or network responses.
  }
}

export async function deleteApiCache(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction("api-cache", "readwrite");
    transaction.objectStore("api-cache").delete(key);
    await transactionDone(transaction);
  } catch {
    // Cache cleanup is best-effort.
  }
}

export async function listApiCacheEntries(): Promise<ApiCacheEntry[]> {
  const db = await openDatabase();
  const transaction = db.transaction("api-cache", "readonly");
  const entries = (await requestResult(transaction.objectStore("api-cache").getAll())) as ApiCacheEntry[];
  await transactionDone(transaction);
  return entries.map(parseApiCacheEntry).filter((entry): entry is ApiCacheEntry => entry !== null);
}

export async function clearApiCacheForUser(userId: number): Promise<void> {
  await invalidateApiCache({ type: "user", userId });
}

export async function invalidateApiCache(scope: ApiCacheScope): Promise<void> {
  try {
    const entries = await listApiCacheEntries();
    const db = await openDatabase();
    const transaction = db.transaction("api-cache", "readwrite");
    const store = transaction.objectStore("api-cache");
    for (const entry of entries) {
      if (entryMatchesScope(entry, scope)) {
        store.delete(entry.key);
      }
    }
    await transactionDone(transaction);
  } catch {
    // Cache invalidation is best-effort; a later request will replace stale data.
  }
}

export function entryMatchesScope(entry: ApiCacheEntry, scope: ApiCacheScope): boolean {
  if (entry.userId !== scope.userId) return false;
  if (scope.type === "all" || scope.type === "user") return true;

  if (scope.type === "deck-list") {
    return entry.pathname === "/api/decks" || entry.pathname === "/api/bootstrap";
  }

  if (scope.type === "stats") {
    if (entry.pathname !== "/api/statistics" && entry.pathname !== "/api/bootstrap") return false;
    return scope.deckId === undefined || entry.query.deckId === String(scope.deckId);
  }

  if (scope.type === "session") {
    const sessionPath = `/api/decks/${scope.deckId}/session`;
    const queuePath = `/api/decks/${scope.deckId}/queue`;
    if (entry.pathname !== sessionPath && entry.pathname !== queuePath) return false;
    return scope.queueType === undefined || entry.query.type === scope.queueType;
  }

  const deckPath = `/api/decks/${scope.deckId}`;
  if (
    entry.pathname === deckPath ||
    entry.pathname.startsWith(`${deckPath}/`) ||
    entry.pathname === "/api/decks" ||
    entry.pathname === "/api/bootstrap"
  ) {
    return true;
  }
  return entry.pathname === "/api/statistics" && entry.query.deckId === String(scope.deckId);
}
