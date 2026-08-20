"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Languages, LogOut, Monitor, Moon, Save, Sun } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { value: "SYSTEM", label: t("themeSystem"), icon: Monitor },
    { value: "LIGHT", label: t("themeLight"), icon: Sun },
    { value: "DARK", label: t("themeDark"), icon: Moon },
  ];

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t("settings")}</h1>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
        </div>

        {message && <div className="rounded-lg bg-success-soft p-3 text-sm font-medium text-success">{message}</div>}
        {error && <div className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-5 p-5">
            <h2 className="text-base font-bold">{t("settings")}</h2>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <KeyRound size={15} /> {t("refreshTime")}
              </span>
              <input
                type="time"
                className="input"
                step={900}
                value={effectiveRefreshTime}
                onChange={(event) => setRefreshTime(event.target.value)}
              />
              <span className="mt-1 block text-xs text-muted">15 {t("minutes")}</span>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <Languages size={15} /> {t("language")}
              </span>
              <select
                className="select"
                value={effectiveLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value as UiLanguage)}
              >
                <option value="ZH">中文</option>
                <option value="EN">English</option>
              </select>
            </label>

            <div>
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">{t("theme")}</span>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = effectiveTheme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn ${active ? "btn-primary" : "btn-secondary"} flex-col py-3 text-xs`}
                      onClick={() => setTheme(option.value)}
                    >
                      <Icon size={17} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button className="btn btn-primary w-full" onClick={saveSettings} disabled={settingsBusy}>
              <Save size={16} /> {t("save")}
            </button>
          </div>

          <div className="space-y-4">
            <form onSubmit={savePassword} className="card space-y-4 p-5">
              <h2 className="text-base font-bold">{t("changePassword")}</h2>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">{t("currentPassword")}</span>
                <input
                  type="password"
                  className="input"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">{t("newPassword")}</span>
                <input
                  type="password"
                  className="input"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </label>
              <button className="btn btn-primary w-full" type="submit" disabled={passwordBusy}>
                <Save size={16} /> {t("save")}
              </button>
            </form>

            <div className="card space-y-3 p-5">
              <h2 className="text-base font-bold">{t("logoutCurrent")}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    await logoutCurrent();
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  <LogOut size={16} /> {t("logoutCurrent")}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (!window.confirm(t("confirmLogoutAll"))) return;
                    await logoutAll();
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  <LogOut size={16} /> {t("logoutAll")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
