"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import type { Settings, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
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
  const { setLanguage } = useI18n();
  const { setMode } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback(
    (next: User) => {
      setUser(next);
      setLanguage(next.settings.language);
      setMode(next.settings.theme);
    },
    [setLanguage, setMode],
  );

  const refresh = async () => {
    try {
      const next = await api<User>("/api/auth/me");
      applyUser(next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("karisanki:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("karisanki:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<User>("/api/auth/me")
      .then((next) => {
        if (!cancelled) applyUser(next);
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const next = await api<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
    });
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
    applyUser(next);
    return next;
  };

  const logoutCurrent = async () => {
    await api<void>("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const logoutAll = async () => {
    await api<void>("/api/auth/logout-all", { method: "POST" });
    setUser(null);
  };

  const updateSettings = async (settings: Settings) => {
    setUser((current) => (current ? { ...current, settings } : current));
    setLanguage(settings.language);
    setMode(settings.theme);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
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
