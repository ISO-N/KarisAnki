"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiErrorMessage, ApiError, clientTimezone } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useNetworkStatus } from "@/lib/network";
import {
  countPendingOutbox,
  createOutboxEntry,
  latestPendingForCard,
  listPendingOutboxForSession,
  markOutboxAccepted,
  markOutboxConflicted,
  clearOutboxForSession,
  clearConflictedOutboxForSession,
} from "@/lib/offline/outbox";
import { mutateLocalQueue } from "@/lib/offline/queue-mutation";
import { loadStoredSession, saveStoredSession, updateStoredSession, clearStoredSession } from "@/lib/offline/session-store";
import {
  sessionKey,
  toStoredSession,
  type OutboxEntry,
  type StoredSession,
  type StudyQueueType,
} from "@/lib/offline/types";
import type { AnswerResponse, AnswerResult, Card, StudySession } from "@/lib/types";

export type StudyPhase =
  | "loading"
  | "resume"
  | "front"
  | "answer"
  | "submitting"
  | "leaving"
  | "entering"
  | "graduate"
  | "confirmForget"
  | "done"
  | "error"
  | "conflict";

export type SyncStatus = "online" | "offline" | "pending" | "syncing" | "synced" | "conflict";

export interface OfflineSessionController {
  session: StoredSession | null;
  phase: StudyPhase;
  card: Card | null;
  error: string;
  syncStatus: SyncStatus;
  pendingCount: number;
  online: boolean;
  resume: () => Promise<void>;
  refresh: () => Promise<void>;
  discardLocalAndRefresh: () => Promise<void>;
  continueAfterConflict: () => Promise<void>;
  submit: (result: AnswerResult, extra?: { graduate?: boolean; confirmForget?: boolean }) => Promise<void>;
  setPhase: (phase: StudyPhase) => void;
}

type SubmitOutcome = "accepted" | "conflict" | "network" | "error";

export function useOfflineSession(
  deckId: number,
  type: StudyQueueType,
): OfflineSessionController {
  const { language, t } = useI18n();
  const key = useMemo(() => sessionKey(deckId, type), [deckId, type]);
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [phase, setPhase] = useState<StudyPhase>("loading");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
  const [pendingCount, setPendingCount] = useState(0);
  const sessionRef = useRef<StoredSession | null>(null);
  const syncingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkOnline = useNetworkStatus();
  const onlineRef = useRef(networkOnline);
  const online = networkOnline;

  useEffect(() => {
    onlineRef.current = networkOnline;
    if (networkOnline) {
      Promise.resolve().then(() => {
        setSyncStatus("pending");
        void syncPendingRef.current();
      });
    } else {
      Promise.resolve().then(() => setSyncStatus("offline"));
    }
  }, [networkOnline]);

  const applySession = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const fresh = await api<StudySession>(
        `/api/decks/${deckId}/session?type=${type}&timezone=${encodeURIComponent(clientTimezone())}`,
      );
      const stored = toStoredSession(fresh);
      await saveStoredSession(stored);
      applySession(stored);
      const pending = await countPendingOutbox(stored.key);
      setPendingCount(pending);
      setSyncStatus(onlineRef.current ? "online" : "offline");
      setPhase(stored.order.length > 0 ? "front" : "done");
    } catch (err) {
      const local = await loadStoredSession(key).catch(() => null);
      if (local) {
        applySession(local);
        setPendingCount(await countPendingOutbox(local.key).catch(() => 0));
        setSyncStatus(onlineRef.current ? "pending" : "offline");
        setPhase(local.order.length > 0 ? "front" : "done");
        return;
      }
      setError(apiErrorMessage(err, language, t("error")));
      setPhase("error");
    }
  }, [applySession, deckId, key, language, t, type]);

  const syncPendingRef = useRef<() => Promise<void>>(async () => {});

  const scheduleRetry = useCallback((attempts: number) => {
    if (retryTimerRef.current !== null) return;
    const backoff = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (onlineRef.current) {
        void syncPendingRef.current();
      }
    }, backoff);
  }, []);

  const submitOutboxEntry = useCallback(async (entry: OutboxEntry): Promise<SubmitOutcome> => {
    try {
      const response = await api<AnswerResponse>("/api/answer", {
        method: "POST",
        idempotent: true,
        retry: { maxRetries: 1, backoffMs: 500 },
        body: JSON.stringify({
          clientAnswerId: entry.clientAnswerId,
          previousClientAnswerId: entry.previousClientAnswerId,
          cardId: entry.cardId,
          result: entry.result,
          queueType: entry.queueType,
          timezone: entry.timezone,
          stateVersion: entry.stateVersion,
          graduate: entry.graduate,
          confirmForget: entry.confirmForget,
        }),
      });

      if (!response.accepted) {
        return "error";
      }

      const current = sessionRef.current;
      if (current) {
        let order = current.order.filter((id) => id !== entry.cardId);
        if (response.nextCardId !== null && response.nextCardId !== order[0] && order.includes(response.nextCardId)) {
          order = [response.nextCardId, ...order.filter((id) => id !== response.nextCardId)];
        }
        if (response.completed) {
          order = [];
        }
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
        applySession(next);
      }

      await markOutboxAccepted(entry.clientAnswerId);
      return "accepted";
    } catch (err) {
      if (err instanceof ApiError && (err.code === "queue_refresh" || err.code === "queue_conflict")) {
        return "conflict";
      }
      if (err instanceof ApiError && err.status === 401) {
        return "error";
      }
      return "network";
    }
  }, [applySession]);

  const syncPending = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || syncingRef.current || !onlineRef.current) {
      if (!onlineRef.current) setSyncStatus("offline");
      return;
    }
    syncingRef.current = true;
    setSyncStatus("syncing");
    try {
      const pending = await listPendingOutboxForSession(current.key);
      if (pending.length === 0) {
        setPendingCount(0);
        setSyncStatus("synced");
        return;
      }

      for (const entry of pending) {
        const outcome = await submitOutboxEntry(entry);
        if (outcome === "accepted") {
          setPendingCount(await countPendingOutbox(current.key));
          continue;
        }
        if (outcome === "conflict") {
          await markOutboxConflicted(entry.clientAnswerId);
          setPendingCount(await countPendingOutbox(current.key));
          setSyncStatus("conflict");
          setPhase("conflict");
          return;
        }
        if (outcome === "error") {
          setError(t("error"));
          setPhase("error");
          return;
        }
        setPendingCount(await countPendingOutbox(current.key));
        setSyncStatus("pending");
        scheduleRetry(entry.attempts);
        return;
      }

      const latest = sessionRef.current;
      const remaining = latest ? await countPendingOutbox(latest.key) : 0;
      setPendingCount(remaining);
      if (latest && remaining === 0 && latest.order.length === 0) {
        await clearStoredSession(latest.key);
        applySession(null);
        setPhase("done");
      } else {
        setSyncStatus("synced");
      }
    } finally {
      syncingRef.current = false;
    }
  }, [applySession, scheduleRetry, submitOutboxEntry, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- ref intentionally tracks the latest sync callback
    syncPendingRef.current = syncPending;
  }, [syncPending]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && onlineRef.current) {
        void syncPendingRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await loadStoredSession(key).catch(() => null);
      if (cancelled) return;
      if (local) {
        applySession(local);
        const pending = await countPendingOutbox(local.key).catch(() => 0);
        setPendingCount(pending);
        if (pending > 0) {
          setSyncStatus(onlineRef.current ? "pending" : "offline");
          setPhase("resume");
          return;
        }
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, key, refresh]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const resume = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    setPhase(current.order.length > 0 ? "front" : "done");
    if (onlineRef.current) {
      void syncPendingRef.current();
    } else {
      setSyncStatus("offline");
    }
  }, []);

  const continueAfterConflict = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    await clearConflictedOutboxForSession(current.key);
    setPendingCount(await countPendingOutbox(current.key));
    setSyncStatus(onlineRef.current ? "pending" : "offline");
    await refresh();
    if (onlineRef.current) {
      void syncPendingRef.current();
    }
  }, [refresh]);

  const discardLocalAndRefresh = useCallback(async () => {
    const current = sessionRef.current;
    if (current) {
      await clearOutboxForSession(current.key);
      setPendingCount(0);
    }
    await refresh();
  }, [refresh]);

  const submit = useCallback(
    async (result: AnswerResult, extra?: { graduate?: boolean; confirmForget?: boolean }) => {
      const current = sessionRef.current;
      if (!current || current.order.length === 0 || phase === "submitting") return;
      const card = current.cards.find((item) => item.id === current.order[0]);
      if (!card) {
        setError(t("error"));
        setPhase("error");
        return;
      }

      const mutation = mutateLocalQueue({
        order: current.order,
        cards: current.cards,
        cardId: card.id,
        result,
        queueType: type,
        confirmForget: extra?.confirmForget,
      });
      if (mutation.requiresConfirmation) {
        setPhase("confirmForget");
        return;
      }

      const previous = (await latestPendingForCard(current.key, card.id))?.clientAnswerId
        ?? current.lastClientAnswerIds[String(card.id)]
        ?? null;
      await createOutboxEntry({
        sessionKey: current.key,
        cardId: card.id,
        result,
        queueType: type,
        timezone: current.timezone || clientTimezone(),
        stateVersion: card.stateVersion,
        previousClientAnswerId: previous,
        graduate: extra?.graduate,
        confirmForget: extra?.confirmForget,
      });

      const next: StoredSession = {
        ...current,
        order: mutation.order,
        cards: mutation.cards,
        completedCount: current.completedCount + 1,
        updatedAt: new Date().toISOString(),
      };
      await updateStoredSession(current.key, {
        order: next.order,
        cards: next.cards,
        completedCount: next.completedCount,
      });
      applySession(next);
      setPendingCount((await countPendingOutbox(current.key)) + 0);

      if (onlineRef.current) {
        setSyncStatus("syncing");
        void syncPendingRef.current();
        setPhase(next.order.length > 0 ? "leaving" : "done");
      } else {
        setSyncStatus("pending");
        setPhase(next.order.length > 0 ? "leaving" : "done");
      }
    },
    [applySession, phase, t, type],
  );

  const card = useMemo(() => {
    if (!session || session.order.length === 0) return null;
    return session.cards.find((item) => item.id === session.order[0]) ?? null;
  }, [session]);

  return {
    session,
    phase,
    card,
    error,
    syncStatus,
    pendingCount,
    online,
    resume,
    refresh,
    discardLocalAndRefresh,
    continueAfterConflict,
    submit,
    setPhase,
  };
}
