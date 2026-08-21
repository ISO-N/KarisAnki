"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function useNetworkStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}
