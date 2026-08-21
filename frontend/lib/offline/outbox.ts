import type { AnswerResult } from "@/lib/types";
import { openDatabase, requestResult, transactionDone } from "@/lib/offline/idb";
import type { OutboxEntry, StudyQueueType } from "@/lib/offline/types";

export interface CreateOutboxEntryInput {
  sessionKey: string;
  cardId: number;
  result: AnswerResult;
  queueType: StudyQueueType;
  timezone: string;
  stateVersion: number;
  previousClientAnswerId?: string | null;
  graduate?: boolean;
  confirmForget?: boolean;
}

export function newClientAnswerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function sortOutboxEntries(entries: OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort(
    (a, b) => a.createdAt - b.createdAt || a.clientAnswerId.localeCompare(b.clientAnswerId),
  );
}

export async function createOutboxEntry(input: CreateOutboxEntryInput): Promise<OutboxEntry> {
  const now = Date.now();
  const entry: OutboxEntry = {
    clientAnswerId: newClientAnswerId(),
    sessionKey: input.sessionKey,
    cardId: input.cardId,
    result: input.result,
    queueType: input.queueType,
    timezone: input.timezone,
    stateVersion: input.stateVersion,
    previousClientAnswerId: input.previousClientAnswerId ?? null,
    graduate: input.graduate ?? false,
    confirmForget: input.confirmForget ?? false,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
  };
  const db = await openDatabase();
  const transaction = db.transaction("outbox", "readwrite");
  transaction.objectStore("outbox").put(entry);
  await transactionDone(transaction);
  return entry;
}

export async function listPendingOutbox(): Promise<OutboxEntry[]> {
  const db = await openDatabase();
  const transaction = db.transaction("outbox", "readonly");
  const store = transaction.objectStore("outbox");
  const entries = (await requestResult(store.getAll())) as OutboxEntry[];
  await transactionDone(transaction);
  return sortOutboxEntries(entries.filter((entry) => entry.status === "PENDING"));
}

export async function listPendingOutboxForSession(sessionKey: string): Promise<OutboxEntry[]> {
  const entries = await listPendingOutbox();
  return entries.filter((entry) => entry.sessionKey === sessionKey);
}

export async function countPendingOutbox(sessionKey?: string): Promise<number> {
  const entries = sessionKey
    ? await listPendingOutboxForSession(sessionKey)
    : await listPendingOutbox();
  return entries.length;
}

export async function latestPendingForCard(
  sessionKey: string,
  cardId: number,
): Promise<OutboxEntry | null> {
  const entries = (await listPendingOutboxForSession(sessionKey))
    .filter((entry) => entry.cardId === cardId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return entries[0] ?? null;
}

export async function markOutboxConflicted(clientAnswerId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("outbox", "readwrite");
  const store = transaction.objectStore("outbox");
  const entry = (await requestResult(store.get(clientAnswerId))) as OutboxEntry | undefined;
  if (entry) {
    store.put({ ...entry, status: "CONFLICTED", updatedAt: Date.now() });
  }
  await transactionDone(transaction);
}

export async function markOutboxAccepted(clientAnswerId: string): Promise<void> {
  await removeOutboxEntry(clientAnswerId);
}

export async function removeOutboxEntry(clientAnswerId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("outbox", "readwrite");
  transaction.objectStore("outbox").delete(clientAnswerId);
  await transactionDone(transaction);
}

export async function clearOutboxForSession(sessionKey: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("outbox", "readwrite");
  const store = transaction.objectStore("outbox");
  const entries = (await requestResult(store.getAll())) as OutboxEntry[];
  for (const entry of entries) {
    if (entry.sessionKey === sessionKey) {
      store.delete(entry.clientAnswerId);
    }
  }
  await transactionDone(transaction);
}

export async function clearConflictedOutboxForSession(sessionKey: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("outbox", "readwrite");
  const store = transaction.objectStore("outbox");
  const entries = (await requestResult(store.getAll())) as OutboxEntry[];
  for (const entry of entries) {
    if (entry.sessionKey === sessionKey && entry.status === "CONFLICTED") {
      store.delete(entry.clientAnswerId);
    }
  }
  await transactionDone(transaction);
}
