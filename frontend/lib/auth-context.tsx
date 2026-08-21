"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { clearApiCacheForUser, invalidateApiCache } from "@/lib/api-cache";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import {
  cacheSettings,
  clearCachedUser,
  readCachedUser,
  writeCachedUser,
} from "@/lib/user-cache";
import type { Settings, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  applyAuthenticatedUser: (user: User) => void;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>;
  register: (
    email: string,
    password: string,
    inviteCode: string,
    rememberMe: boolean,
  ) => Promise<User>;
  logoutCurrent: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setLanguage } = useI18n();
  const { setMode } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback(
    (next: User) => {
      setUser(next);
      setLanguage(next.settings.language);
      setMode(next.settings.theme);
      writeCachedUser(next);
    },
    [setLanguage, setMode],
  );

  const applyAuthenticatedUser = useCallback(
    (next: User) => {
      applyUser(next);
    },
    [applyUser],
  );

  const clearUser = useCallback(() => {
    const cached = readCachedUser();
    if (cached) {
      void clearApiCacheForUser(cached.id);
    }
    setUser(null);
    clearCachedUser();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api<User>("/api/auth/me");
      applyUser(next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearUser();
      }
    } finally {
      setLoading(false);
    }
  }, [applyUser, clearUser]);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedUser();
    if (cached) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setUser(cached);
          setLanguage(cached.settings.language);
          setMode(cached.settings.theme);
          setLoading(false);
        }
      });
    }

    if (pathname === "/") {
      if (!cached) {
        Promise.resolve().then(() => {
          if (!cancelled) setLoading(false);
        });
      }
      return () => {
        cancelled = true;
      };
    }

    api<User>("/api/auth/me")
      .then((next) => {
        if (!cancelled) applyUser(next);
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          clearUser();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyUser, clearUser, pathname, setLanguage, setMode]);

  useEffect(() => {
    const handleUnauthorized = () => clearUser();
    window.addEventListener("karisanki:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("karisanki:unauthorized", handleUnauthorized);
  }, [clearUser]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const next = await api<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
    });
    const cached = readCachedUser();
    if (cached && cached.id !== next.id) {
      await clearApiCacheForUser(cached.id);
    }
    applyUser(next);
    return next;
  };

  const register = async (
    email: string,
    password: string,
    inviteCode: string,
    rememberMe: boolean,
  ) => {
    const language = navigator.language.toLowerCase().startsWith("zh") ? "ZH" : "EN";
    const next = await api<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, inviteCode, rememberMe, language }),
    });
    const cached = readCachedUser();
    if (cached && cached.id !== next.id) {
      await clearApiCacheForUser(cached.id);
    }
    applyUser(next);
    return next;
  };

  const logoutCurrent = async () => {
    try {
      await api<void>("/api/auth/logout", { method: "POST" });
    } finally {
      clearUser();
    }
  };

  const logoutAll = async () => {
    try {
      await api<void>("/api/auth/logout-all", { method: "POST" });
    } finally {
      clearUser();
    }
  };

  const updateSettings = async (settings: Settings) => {
    setUser((current) => (current ? { ...current, settings } : current));
    setLanguage(settings.language);
    setMode(settings.theme);
    cacheSettings(settings);
    if (user) {
      await invalidateApiCache({ type: "deck-list", userId: user.id });
      await invalidateApiCache({ type: "stats", userId: user.id });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        applyAuthenticatedUser,
        login,
        register,
        logoutCurrent,
        logoutAll,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
