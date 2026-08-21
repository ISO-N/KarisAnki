"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiErrorMessage } from "@/lib/api";
import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; inviteCode?: string }>({});
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);

  useEffect(() => {
    if (isRegister) {
      api<RegistrationStatus>("/api/auth/registration-status")
        .then(setRegistration)
        .catch(() => setRegistration({ enabled: false, inviteRequired: true }));
    }
  }, [isRegister]);

  const validate = () => {
    const next: { email?: string; password?: string; confirmPassword?: string; inviteCode?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("error");
    }
    if (password.length < 8) {
      next.password = t("error");
    }
    if (isRegister && password !== confirmPassword) {
      next.confirmPassword = t("passwordMismatch");
    }
    if (isRegister && !inviteCode.trim()) {
      next.inviteCode = t("error");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    setBusy(true);
    try {
      if (isRegister) {
        await register(email, password, inviteCode, rememberMe);
      } else {
        await login(email, password, rememberMe);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[420px] flex-col justify-center py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground">
          K
        </span>
        <div>
          <h1 className="text-xl font-semibold">KarisAnki</h1>
          <p className="text-sm text-muted-foreground">
            {isRegister ? t("registerTitle") : t("loginTitle")}
          </p>
        </div>
      </div>

      {isRegister && registration && !registration.enabled ? (
        <Alert className="mb-4" role="alert">
          <AlertCircle />
          <AlertTitle>{t("registrationUnavailable")}</AlertTitle>
          <AlertDescription>{t("registrationUnavailable")}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field data-invalid={!!fieldErrors.email}>
                <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  required
                />
                {fieldErrors.email ? <FieldError>{fieldErrors.email}</FieldError> : null}
              </Field>

              <Field data-invalid={!!fieldErrors.password}>
                <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={!!fieldErrors.password}
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-sm"
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      aria-pressed={showPassword}
                      aria-controls="password"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldErrors.password ? <FieldError>{fieldErrors.password}</FieldError> : null}
              </Field>

              {isRegister ? (
                <Field data-invalid={!!fieldErrors.confirmPassword}>
                  <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      aria-invalid={!!fieldErrors.confirmPassword}
                      required
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-sm"
                        aria-label={showConfirmPassword ? t("hidePassword") : t("showPassword")}
                        aria-pressed={showConfirmPassword}
                        aria-controls="confirmPassword"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldErrors.confirmPassword ? <FieldError>{fieldErrors.confirmPassword}</FieldError> : null}
                </Field>
              ) : null}

              {isRegister ? (
                <Field data-invalid={!!fieldErrors.inviteCode}>
                  <FieldLabel htmlFor="inviteCode">
                    <ShieldCheck />
                    {t("inviteCode")}
                  </FieldLabel>
                  <Input
                    id="inviteCode"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    aria-invalid={!!fieldErrors.inviteCode}
                    required
                  />
                  {fieldErrors.inviteCode ? <FieldError>{fieldErrors.inviteCode}</FieldError> : null}
                </Field>
              ) : null}

              <Field orientation="horizontal">
                <Switch
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked)}
                />
                <FieldLabel htmlFor="rememberMe">{t("rememberMe")}</FieldLabel>
              </Field>

              {error ? (
                <Alert variant="destructive" role="alert">
                  <AlertCircle />
                  <AlertTitle>{t("error")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                className="h-11 w-full"
                size="lg"
                type="submit"
                disabled={busy || (isRegister && !registration?.enabled)}
              >
                {busy ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : isRegister ? (
                  <UserPlus data-icon="inline-start" />
                ) : (
                  <LogIn data-icon="inline-start" />
                )}
                {isRegister ? t("register") : t("login")}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isRegister ? t("haveAccount") : t("noAccount")}{" "}
        <Link className="font-semibold text-primary" href={isRegister ? "/login" : "/register"}>
          {isRegister ? t("toLogin") : t("toRegister")}
        </Link>
      </p>
    </div>
  );
}
