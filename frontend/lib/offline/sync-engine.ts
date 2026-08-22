import { api, ApiError } from "@/lib/api";
import { apiCacheKey, invalidateApiCache, writeApiCache } from "@/lib/api-cache";
import { isOnline } from "@/lib/network";
import {
  chunkOutboxEntries,
  countPendingOutbox,
  listPendingOutbox,
  listPendingOutboxForSession,
  markOutboxAccepted,
  markOutboxConflicted,
  OUTBOX_BATCH_SIZE,
} from "@/lib/offline/outbox";
import { mergeAcceptedAnswerOrder } from "@/lib/offline/session-merge";
import {
  clearStoredSession,
  listStoredSessions,
  loadStoredSession,
  updateStoredSession,
} from "@/lib/offline/session-store";
import type { OutboxEntry, StoredSession } from "@/lib/offline/types";
import type {
  AnswerBatchItemRequest,
  AnswerBatchItemResponse,
  AnswerBatchResponse,
  AnswerResponse,
  StudySession,
} from "@/lib/types";

export type SyncOutcome = "synced" | "pending" | "conflict" | "offline" | "error";
export type SyncEngineStatus = "syncing" | "pending" | "synced" | "offline" | "conflict" | "error";

export interface SyncEngineEvent {
  key: string;
  session: StoredSession | null;
  pendingCount: number;
  status: SyncEngineStatus;
  acceptedAnswer?: {
    cardId: number;
    clientAnswerId: string;
  };
}

type SyncEngineListener = (event: SyncEngineEvent) => void;

const listeners = new Set<SyncEngineListener>();
let syncQueue: Promise<unknown> = Promise.resolve();

function emit(event: SyncEngineEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeSyncEngine(listener: SyncEngineListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const run = syncQueue.then(operation, operation);
  syncQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetSyncEngineForTest(): void {
  syncQueue = Promise.resolve();
  listeners.clear();
}

function toBatchItem(entry: OutboxEntry): AnswerBatchItemRequest {
  return {
    clientAnswerId: entry.clientAnswerId,
    cardId: entry.cardId,
    result: entry.result,
    stateVersion: entry.stateVersion,
    previousClientAnswerId: entry.previousClientAnswerId,
    graduate: entry.graduate,
    confirmForget: entry.confirmForget,
  };
}

function toAnswerResponse(result: AnswerBatchItemResponse): AnswerResponse {
  return {
    cardId: result.cardId,
    clientAnswerId: result.clientAnswerId,
    accepted: result.accepted,
    nextCardId: result.nextCardId,
    completed: result.completed,
    requiresConfirmation: result.requiresConfirmation,
  };
}

async function writeSessionCache(session: StoredSession, userId?: number): Promise<void> {
  if (!userId) return;
  const path = `/api/decks/${session.deckId}/session?type=${session.type}&timezone=${encodeURIComponent(session.timezone)}`;
  const payload: StudySession = {
    deckId: session.deckId,
    type: session.type,
    timezone: session.timezone,
    order: session.order,
    cards: session.cards,
    total: session.total,
  };
  await writeApiCache(apiCacheKey(userId, "GET", path), userId, "GET", path, payload);
}

async function invalidateAfterAnswer(session: StoredSession, userId?: number): Promise<void> {
  if (!userId) return;
  await invalidateApiCache({ type: "deck", userId, deckId: session.deckId });
  await invalidateApiCache({ type: "stats", userId });
}

async function applyAcceptedToSession(entry: OutboxEntry, response: AnswerResponse, userId?: number): Promise<StoredSession | null> {
  const current = await loadStoredSession(entry.sessionKey);
  if (!current) return null;
  const currentCard = current.cards.find((item) => item.id === entry.cardId);
  const reinserted = entry.reinserted ?? currentCard?.status === "relearn";
  const order = mergeAcceptedAnswerOrder({
    order: current.order,
    cardId: entry.cardId,
    nextCardId: response.nextCardId,
    completed: response.completed,
    reinserted,
  });
  const next: StoredSession = {
    ...current,
    order,
    lastSyncedAt: new Date().toISOString(),
    lastClientAnswerIds: {
      ...current.lastClientAnswerIds,
      [String(entry.cardId)]: entry.clientAnswerId,
    },
  };
  await updateStoredSession(current.key, {
    order: next.order,
    lastSyncedAt: next.lastSyncedAt,
    lastClientAnswerIds: next.lastClientAnswerIds,
  });
  await writeSessionCache(next, userId);
  return next;
}

function isConflictCode(code: string): boolean {
  return code === "queue_refresh" || code === "queue_conflict" || code === "confirmation_required";
}

async function emitSessionState(key: string, status: SyncEngineStatus): Promise<StoredSession | null> {
  const session = await loadStoredSession(key);
  const pendingCount = await countPendingOutbox(key);
  emit({ key, session, pendingCount, status });
  return session;
}

async function performSyncSession(key: string, userId?: number): Promise<SyncOutcome> {
  if (!isOnline()) {
    await emitSessionState(key, "offline");
    return "offline";
  }

  const initial = await loadStoredSession(key);
  if (!initial) {
    const pending = await countPendingOutbox(key);
    emit({ key, session: null, pendingCount: pending, status: pending > 0 ? "error" : "synced" });
    return pending > 0 ? "error" : "synced";
  }

  emit({ key, session: initial, pendingCount: await countPendingOutbox(key), status: "syncing" });

  while (true) {
    const pending = await listPendingOutboxForSession(key);
    if (pending.length === 0) break;
    if (!isOnline()) {
      await emitSessionState(key, "offline");
      return "offline";
    }

    for (const chunk of chunkOutboxEntries(pending, OUTBOX_BATCH_SIZE)) {
      let response: AnswerBatchResponse;
      try {
        response = await api<AnswerBatchResponse>("/api/answer/batch", {
          method: "POST",
          idempotent: true,
          retry: { maxRetries: 1, backoffMs: 500 },
          body: JSON.stringify({
            deckId: initial.deckId,
            queueType: initial.type,
            timezone: initial.timezone,
            items: chunk.map(toBatchItem),
          }),
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await emitSessionState(key, "error");
          return "error";
        }
        await emitSessionState(key, "pending");
        return "pending";
      }

      let conflict = false;
      for (const result of response.results) {
        const entry = chunk.find((item) => item.clientAnswerId === result.clientAnswerId);
        if (!entry) continue;

        if (result.accepted) {
          const updated = await applyAcceptedToSession(entry, toAnswerResponse(result), userId);
          const pendingCount = await countPendingOutbox(entry.sessionKey);
          await markOutboxAccepted(entry.clientAnswerId);
          emit({
            key: entry.sessionKey,
            session: updated,
            pendingCount,
            status: "syncing",
            acceptedAnswer: {
              cardId: entry.cardId,
              clientAnswerId: entry.clientAnswerId,
            },
          });
          await invalidateAfterAnswer(initial, userId);
          continue;
        }

        if (isConflictCode(result.code)) {
          await markOutboxConflicted(entry.clientAnswerId);
          conflict = true;
          continue;
        }

        await emitSessionState(key, "error");
        return "error";
      }

      if (conflict) {
        await emitSessionState(key, "conflict");
        return "conflict";
      }
    }
  }

  const session = await loadStoredSession(key);
  const remaining = await countPendingOutbox(key);
  if (remaining === 0 && session?.order.length === 0) {
    await clearStoredSession(key);
    emit({ key, session: null, pendingCount: 0, status: "synced" });
    return "synced";
  }
  emit({ key, session, pendingCount: remaining, status: remaining > 0 ? "pending" : "synced" });
  return remaining > 0 ? "pending" : "synced";
}

export function syncSession(key: string, userId?: number): Promise<SyncOutcome> {
  return enqueue(() => performSyncSession(key, userId));
}

export async function syncAllPending(userId?: number): Promise<SyncOutcome[]> {
  const sessions = await listStoredSessions();
  const pendingKeys = new Set((await listPendingOutbox()).map((entry) => entry.sessionKey));
  const outcomes: SyncOutcome[] = [];
  for (const session of sessions) {
    if (pendingKeys.has(session.key)) {
      outcomes.push(await syncSession(session.key, userId));
    }
  }
  return outcomes;
}
