"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useStoredValue } from "@/lib/storage";
import type { ThemeMode } from "@/lib/types";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveDark(mode: ThemeMode) {
  if (mode === "DARK") return true;
  if (mode === "LIGHT") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [storedMode, setStoredMode] = useStoredValue<ThemeMode>("karisanki-theme", "SYSTEM");
  const mode: ThemeMode =
    storedMode === "SYSTEM" || storedMode === "LIGHT" || storedMode === "DARK" ? storedMode : "SYSTEM";

  useEffect(() => {
    const apply = () => {
      document.documentElement.classList.toggle("dark", resolveDark(mode));
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);

  const setMode = (next: ThemeMode) => setStoredMode(next);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
