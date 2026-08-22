"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNetworkStatus } from "@/lib/network";
import { syncAllPending } from "@/lib/offline/sync-engine";

const BACKGROUND_SYNC_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;

export function BackgroundSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const online = useNetworkStatus();
  const onlineRef = useRef(online);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let inFlight = false;
    let retryAfter = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled || inFlight || !onlineRef.current) return;
      inFlight = true;
      try {
        const outcomes = await syncAllPending(userId);
        const needsRetry = outcomes.some((outcome) => outcome === "pending" || outcome === "offline");
        if (!needsRetry) {
          retryAfter = 0;
          return;
        }
        const backoff = retryAfter === 0 ? 1_000 : Math.min(retryAfter * 2, MAX_BACKOFF_MS);
        retryAfter = backoff;
        if (retryTimer !== null) {
          clearTimeout(retryTimer);
        }
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void run();
        }, backoff);
      } finally {
        inFlight = false;
      }
    };

    const trigger = () => {
      if (onlineRef.current && userId) {
        void run();
      }
    };
    window.addEventListener("online", trigger);
    window.addEventListener("focus", trigger);
    document.addEventListener("visibilitychange", trigger);
    const interval = window.setInterval(trigger, BACKGROUND_SYNC_INTERVAL_MS);
    trigger();

    return () => {
      cancelled = true;
      window.removeEventListener("online", trigger);
      window.removeEventListener("focus", trigger);
      document.removeEventListener("visibilitychange", trigger);
      window.clearInterval(interval);
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
      }
    };
  }, [userId]);

  return null;
}
