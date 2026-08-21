"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import {
  apiCacheKey,
  readApiCache,
  writeApiCache,
  type CacheQueryValue,
} from "@/lib/api-cache";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export interface UseApiDataOptions<T> {
  path: string;
  query?: Record<string, CacheQueryValue>;
  enabled?: boolean;
  auth?: "required" | "optional";
  scopeUserId?: number | "guest";
  onData?: (data: T) => void;
}

function requestPath(path: string, query?: Record<string, CacheQueryValue>) {
  const url = new URL(path, "http://karisanki.local");
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

export interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: () => void;
}

export function useApiData<T>(options: UseApiDataOptions<T>): UseApiDataResult<T> {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const dataRef = useRef<T | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const onDataRef = useRef(options.onData);
  useEffect(() => {
    onDataRef.current = options.onData;
  }, [options.onData]);

  const userId = options.scopeUserId ?? user?.id ?? (options.auth === "optional" ? "guest" : null);
  const enabled = options.enabled !== false && userId !== null;
  const cacheKey = enabled ? apiCacheKey(userId, "GET", options.path, options.query) : null;

  useEffect(() => {
    if (lastKeyRef.current !== cacheKey) {
      lastKeyRef.current = cacheKey;
      dataRef.current = null;
      setData(null);
      setLoading(cacheKey !== null);
      setRefreshing(false);
      setError("");
    }
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !cacheKey) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
          setData(null);
          dataRef.current = null;
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const cached = await readApiCache<T>(cacheKey).catch(() => null);
      if (cancelled) return;
      if (cached !== null) {
        dataRef.current = cached;
        setData(cached);
        setLoading(false);
        setRefreshing(true);
      } else if (dataRef.current === null) {
        setLoading(true);
      }

      try {
        const fresh = await api<T>(requestPath(options.path, options.query), {
          retry: { maxRetries: 1, backoffMs: 300 },
        });
        if (cancelled) return;
        dataRef.current = fresh;
        setData(fresh);
        setLoading(false);
        setRefreshing(false);
        setError("");
        if (userId !== "guest") {
          await writeApiCache(cacheKey, userId, "GET", options.path, fresh, options.query);
        }
        onDataRef.current?.(fresh);
      } catch (err) {
        if (cancelled) return;
        setRefreshing(false);
        if (dataRef.current === null) {
          setError(apiErrorMessage(err, language, t("error")));
          setLoading(false);
        } else {
          setError("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query is encoded into cacheKey and only needed by the write path
  }, [cacheKey, enabled, language, options.path, t, userId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError("");
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (nonce === 0) return;
    void (async () => {
      if (!cacheKey || userId === null) return;
      try {
        const fresh = await api<T>(requestPath(options.path, options.query), {
          retry: { maxRetries: 1, backoffMs: 300 },
        });
        dataRef.current = fresh;
        setData(fresh);
        setLoading(false);
        setRefreshing(false);
        if (userId !== "guest") {
          await writeApiCache(cacheKey, userId, "GET", options.path, fresh, options.query);
        }
        onDataRef.current?.(fresh);
      } catch (err) {
        setRefreshing(false);
        if (dataRef.current === null) {
          setError(apiErrorMessage(err, language, t("error")));
          setLoading(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nonce is only a manual refresh trigger
  }, [nonce]);

  return { data, loading, refreshing, error, refresh };
}
