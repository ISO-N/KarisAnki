"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { apiCacheKey, readApiCache, writeApiCache } from "@/lib/api-cache";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useNetworkStatus } from "@/lib/network";
import {
  clearConflictedOutboxForSession,
  clearOutboxForSession,
  countConflictedOutboxForSession,
  countPendingOutbox,
  createOutboxEntry,
  latestPendingForCard,
  OUTBOX_BATCH_SIZE,
} from "@/lib/offline/outbox";
import { mutateLocalQueue } from "@/lib/offline/queue-mutation";
import {
  loadStoredSession,
  saveStoredSession,
  updateStoredSession,
} from "@/lib/offline/session-store";
import { subscribeSyncEngine, syncSession } from "@/lib/offline/sync-engine";
import {
  sessionKey,
  toStoredSession,
  type StoredSession,
  type StudyQueueType,
} from "@/lib/offline/types";
import type { AnswerResult, Card, StudySession } from "@/lib/types";

export const USE_BATCH_ANSWER_API = true;
export const SYNC_FLUSH_DELAY_MS = 500;

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

export function useOfflineSession(
  deckId: number,
  type: StudyQueueType,
): OfflineSessionController {
  const { language, t } = useI18n();
  const { user } = useAuth();
  const key = useMemo(() => sessionKey(deckId, type), [deckId, type]);
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [phase, setPhase] = useState<StudyPhase>("loading");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
  const [pendingCount, setPendingCount] = useState(0);
  const sessionRef = useRef<StoredSession | null>(null);
  const syncingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const sessionPath = useCallback(
    (timezone: string) =>
      `/api/decks/${deckId}/session?type=${type}&timezone=${encodeURIComponent(timezone)}`,
    [deckId, type],
  );

  const writeSessionCache = useCallback(
    async (stored: StoredSession) => {
      if (!user) return;
      const payload: StudySession = {
        deckId: stored.deckId,
        type: stored.type,
        timezone: stored.timezone,
        order: stored.order,
        cards: stored.cards,
        total: stored.total,
      };
      const path = sessionPath(stored.timezone);
      const cacheKey = apiCacheKey(user.id, "GET", path);
      await writeApiCache(cacheKey, user.id, "GET", path, payload);
    },
    [sessionPath, user],
  );

  const refresh = useCallback(async () => {
    setPhase("loading");
    setError("");
    const timezone = clientTimezone();
    const path = sessionPath(timezone);
    const cacheKey = user ? apiCacheKey(user.id, "GET", path) : null;
    try {
      const pending = await countPendingOutbox(key).catch(() => 0);
      const conflicted = await countConflictedOutboxForSession(key).catch(() => 0);
      const hasLocalOutbox = pending > 0 || conflicted > 0;
      const localChain = hasLocalOutbox ? await loadStoredSession(key).catch(() => null) : null;
      const cached = cacheKey && pending === 0 && conflicted === 0
        ? await readApiCache<StudySession>(cacheKey)
        : null;
      if (cached) {
        const stored = toStoredSession(cached);
        await saveStoredSession(stored);
        applySession(stored);
        setPendingCount(0);
        setSyncStatus(onlineRef.current ? "pending" : "offline");
        setPhase(stored.order.length > 0 ? "front" : "done");
      }

      const fresh = await api<StudySession>(path);
      const stored = localChain ? { ...toStoredSession(fresh), lastClientAnswerIds: localChain.lastClientAnswerIds } : toStoredSession(fresh);
      await saveStoredSession(stored);
      await writeSessionCache(stored);
      applySession(stored);
      const pendingFresh = await countPendingOutbox(stored.key);
      setPendingCount(pendingFresh);
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
  }, [applySession, key, language, sessionPath, t, user, writeSessionCache]);

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

  const scheduleSync = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
    }
    void countPendingOutbox(key).then((count) => {
      if (count >= OUTBOX_BATCH_SIZE) {
        if (onlineRef.current) void syncPendingRef.current();
        return;
      }
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        if (onlineRef.current) void syncPendingRef.current();
      }, SYNC_FLUSH_DELAY_MS);
    });
  }, [key]);

  const syncPending = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || syncingRef.current) return;
    if (!onlineRef.current) {
      setSyncStatus("offline");
      return;
    }
    syncingRef.current = true;
    setSyncStatus("syncing");
    try {
      await syncSession(current.key, user?.id);
    } finally {
      syncingRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- ref intentionally tracks the latest sync callback
    syncPendingRef.current = syncPending;
  }, [syncPending]);

  useEffect(() => {
    return subscribeSyncEngine((event) => {
      if (event.key !== key) return;
      setPendingCount(event.pendingCount);

      if (event.acceptedAnswer) {
        const current = sessionRef.current;
        if (current) {
          applySession({
            ...current,
            lastClientAnswerIds: {
              ...current.lastClientAnswerIds,
              [String(event.acceptedAnswer.cardId)]: event.acceptedAnswer.clientAnswerId,
            },
          });
        }
        return;
      }

      if (event.status === "conflict") {
        setSyncStatus("conflict");
        setPhase("conflict");
        return;
      }
      if (event.status === "pending" && event.pendingCount > 0) {
        scheduleRetry(0);
      }
      if (event.status === "error") {
        setError(t("error"));
        setSyncStatus("pending");
        setPhase("error");
        return;
      }
      if (event.status === "offline") {
        setSyncStatus("offline");
        return;
      }

      if (event.session) {
        applySession(event.session);
      } else if (event.status === "synced") {
        applySession(null);
      }

      setSyncStatus(
        event.status === "syncing"
          ? "syncing"
          : event.status === "pending"
            ? "pending"
            : "synced",
      );

      if (event.status === "synced" && (!event.session || event.session.order.length === 0)) {
        setPhase("done");
      }
    });
  }, [applySession, key, scheduleRetry, t]);

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
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const resume = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    setPhase(current.order.length > 0 ? "front" : "done");
    if (onlineRef.current) {
      setSyncStatus("syncing");
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
      setSyncStatus("syncing");
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
        reinserted: mutation.reinserted,
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
        scheduleSync();
        setPhase(next.order.length > 0 ? "leaving" : "done");
      } else {
        setSyncStatus("pending");
        setPhase(next.order.length > 0 ? "leaving" : "done");
      }
    },
    [applySession, phase, scheduleSync, t, type],
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
