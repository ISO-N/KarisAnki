"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function useStoredValue<T extends string>(key: string, fallback: T): [T, (next: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key) as T | null,
    getServerSnapshot,
  );
  const value = raw === null ? fallback : raw;
  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage may be unavailable in private browsing modes.
      }
      notify();
    },
    [key],
  );
  return [value, setValue];
}
