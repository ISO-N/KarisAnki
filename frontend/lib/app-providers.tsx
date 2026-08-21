"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
