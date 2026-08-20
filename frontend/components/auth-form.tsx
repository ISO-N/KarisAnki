"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiErrorMessage } from "@/lib/api";
import { KeyRound, LogIn, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { RegistrationStatus } from "@/lib/types";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const { login, register } = useAuth();
  const { t, language } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);

  useEffect(() => {
    if (isRegister) {
      api<RegistrationStatus>("/api/auth/registration-status")
        .then(setRegistration)
        .catch(() => setRegistration({ enabled: false, inviteRequired: true }));
    }
  }, [isRegister]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) {
        await register(email, password, inviteCode, rememberMe);
      } else {
        await login(email, password, rememberMe);
      }
      router.push("/decks");
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-xl font-black text-white">
            K
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">KarisAnki</h1>
            <p className="text-sm text-muted">{isRegister ? t("registerTitle") : t("loginTitle")}</p>
          </div>
        </div>

        {isRegister && registration && !registration.enabled && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm font-medium text-warning">
            {t("registrationUnavailable")}
          </div>
        )}

        <form onSubmit={submit} className="card space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <Mail size={15} /> {t("email")}
            </span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <KeyRound size={15} /> {t("password")}
            </span>
            <input
              className="input"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {isRegister && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={15} /> {t("inviteCode")}
              </span>
              <input
                className="input"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                required
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            {t("rememberMe")}
          </label>

          {error && <div className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">{error}</div>}

          <button className="btn btn-primary w-full" type="submit" disabled={busy || (isRegister && !registration?.enabled)}>
            {isRegister ? <UserPlus size={17} /> : <LogIn size={17} />}
            {isRegister ? t("register") : t("login")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {isRegister ? t("haveAccount") : t("noAccount")}{" "}
          <Link className="font-semibold text-accent" href={isRegister ? "/login" : "/register"}>
            {isRegister ? t("toLogin") : t("toRegister")}
          </Link>
        </p>
      </div>
    </div>
  );
}
