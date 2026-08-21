import type { Settings, User } from "@/lib/types";

const USER_CACHE_KEY = "karisanki-user-cache";

export function readCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    if (
      typeof parsed.id !== "number" ||
      typeof parsed.email !== "string" ||
      !parsed.settings ||
      typeof parsed.settings.userId !== "number" ||
      typeof parsed.settings.refreshTime !== "string" ||
      (parsed.settings.language !== "ZH" && parsed.settings.language !== "EN") ||
      (parsed.settings.theme !== "SYSTEM" &&
        parsed.settings.theme !== "LIGHT" &&
        parsed.settings.theme !== "DARK")
    ) {
      return null;
    }
    return parsed as User;
  } catch {
    return null;
  }
}

export function writeCachedUser(user: User): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function clearCachedUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function cacheSettings(settings: Settings): void {
  const user = readCachedUser();
  if (!user) return;
  writeCachedUser({ ...user, settings });
}
