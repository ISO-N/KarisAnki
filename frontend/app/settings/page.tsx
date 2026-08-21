"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Languages, LoaderCircle, LogOut, Monitor, Moon, Save, Sun } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import type { Settings, ThemeMode, UiLanguage } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateSettings, logoutCurrent, logoutAll } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { setMode } = useTheme();
  const [refreshTime, setRefreshTime] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<UiLanguage | null>(null);
  const [theme, setTheme] = useState<ThemeMode | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const effectiveRefreshTime = refreshTime ?? user?.settings.refreshTime.slice(0, 5) ?? "04:00";
  const effectiveLanguage = selectedLanguage ?? user?.settings.language ?? "ZH";
  const effectiveTheme = theme ?? user?.settings.theme ?? "SYSTEM";

  const saveSettings = async () => {
    setMessage("");
    setError("");
    setSettingsBusy(true);
    try {
      const next = await api<Settings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          refreshTime: `${effectiveRefreshTime}:00`,
          language: effectiveLanguage,
          theme: effectiveTheme,
        }),
      });
      await updateSettings(next);
      setRefreshTime(next.refreshTime.slice(0, 5));
      setSelectedLanguage(next.language);
      setTheme(next.theme);
      setLanguage(next.language);
      setMode(next.theme);
      setMessage(t("settingsUpdated"));
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setSettingsBusy(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError(t("error"));
      return;
    }
    setPasswordBusy(true);
    try {
      await api<void>("/api/settings/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t("passwordUpdated"));
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setPasswordBusy(false);
    }
  };

  const confirmLogoutAll = async () => {
    setLogoutBusy(true);
    try {
      await logoutAll();
      setLogoutAllOpen(false);
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setLogoutBusy(false);
    }
  };

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { value: "SYSTEM", label: t("themeSystem"), icon: Monitor },
    { value: "LIGHT", label: t("themeLight"), icon: Sun },
    { value: "DARK", label: t("themeDark"), icon: Moon },
  ];

  return (
    <RequireAuth>
      <div className="dashboard-viewport flex flex-col gap-6">
        <PageHeader title={t("settings")} description={user?.email} />

        {message ? (
          <Alert role="status">
            <CheckCircle2 />
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{t("error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings")}</CardTitle>
              <CardDescription>{t("refreshTime")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="refresh-time">
                    <KeyRound className="size-4 text-primary" aria-hidden="true" />
                    {t("refreshTime")}
                  </FieldLabel>
                  <Input
                    id="refresh-time"
                    type="time"
                    step={900}
                    value={effectiveRefreshTime}
                    onChange={(event) => setRefreshTime(event.target.value)}
                  />
                  <FieldDescription>15 {t("minutes")}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="language">
                    <Languages className="size-4 text-primary" aria-hidden="true" />
                    {t("language")}
                  </FieldLabel>
                  <Select
                    value={effectiveLanguage}
                    onValueChange={(value) => setSelectedLanguage(value as UiLanguage)}
                    items={{ ZH: "中文", EN: "English" }}
                  >
                    <SelectTrigger className="w-full" id="language" aria-label={t("language")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZH">中文</SelectItem>
                      <SelectItem value="EN">English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("theme")}</FieldLabel>
                  <ToggleGroup
                    value={[effectiveTheme]}
                    onValueChange={(values) => {
                      const next = values[0] as ThemeMode | undefined;
                      if (next) setTheme(next);
                    }}
                    className="grid w-full grid-cols-3 gap-2"
                  >
                    {themeOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <ToggleGroupItem
                          key={option.value}
                          value={option.value}
                          className="flex-col gap-2 py-3"
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          <span>{option.label}</span>
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </Field>

                <Button onClick={saveSettings} disabled={settingsBusy} className="h-11 w-full">
                  {settingsBusy ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  {t("save")}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("changePassword")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={savePassword} noValidate>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="current-password">{t("currentPassword")}</FieldLabel>
                      <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />
                    </Field>
                    <Field data-invalid={!!passwordError}>
                      <FieldLabel htmlFor="new-password">{t("newPassword")}</FieldLabel>
                      <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        aria-invalid={!!passwordError}
                        required
                      />
                      {passwordError ? <FieldError>{passwordError}</FieldError> : null}
                    </Field>
                    <Button type="submit" disabled={passwordBusy} className="h-11 w-full">
                      {passwordBusy ? (
                        <LoaderCircle data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <Save data-icon="inline-start" />
                      )}
                      {t("save")}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("logoutCurrent")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={async () => {
                    try {
                      await logoutCurrent();
                      router.push("/login");
                      router.refresh();
                    } catch (err) {
                      setError(apiErrorMessage(err, language, t("error")));
                    }
                  }}
                >
                  <LogOut data-icon="inline-start" />
                  {t("logoutCurrent")}
                </Button>
                <Button variant="destructive" className="h-11" onClick={() => setLogoutAllOpen(true)}>
                  <LogOut data-icon="inline-start" />
                  {t("logoutAll")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={logoutAllOpen} onOpenChange={(open) => !open && setLogoutAllOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logoutAllTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("logoutAllDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLogoutAllOpen(false)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmLogoutAll} disabled={logoutBusy}>
              {logoutBusy ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <LogOut data-icon="inline-start" />
              )}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RequireAuth>
  );
}
