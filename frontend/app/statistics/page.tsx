"use client";

/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount is an external data sync */
import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarClock, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { useI18n } from "@/lib/i18n";
import type { Statistics } from "@/lib/types";

function maxValue(values: number[]) {
  return Math.max(1, ...values);
}

export default function StatisticsPage() {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [deckId, setDeckId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selectedDeckId: string) => {
    try {
      const query = selectedDeckId ? `&deckId=${selectedDeckId}` : "";
      const data = await api<Statistics>(
        `/api/statistics?timezone=${encodeURIComponent(clientTimezone())}${query}`,
      );
      setStats(data);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    load(deckId);
  }, [deckId, load]);

  if (loading && !stats) {
    return (
      <RequireAuth>
        <div className="flex min-h-[50vh] items-center justify-center text-muted">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent" />
        </div>
      </RequireAuth>
    );
  }

  const stageEntries = stats ? Object.entries(stats.stageDistribution) : [];
  const hourEntries = stats ? Object.entries(stats.hourlyDistribution) : [];
  const resultColors: Record<string, string> = {
    FAMILIAR: "var(--success)",
    BLURRY: "var(--warning)",
    FORGOT: "var(--danger)",
  };

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t("statistics")}</h1>
            <p className="mt-1 text-sm text-muted">{stats?.learningDay}</p>
          </div>
          <select className="select sm:w-64" value={deckId} onChange={(event) => setDeckId(event.target.value)}>
            <option value="">{t("allDecks")}</option>
            {stats?.deckOptions.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name} {deck.deleted ? `(${t("deletedDeck")})` : ""}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">{error}</div>}

        {!stats ? (
          <div className="empty">{t("emptyStatistics")}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric icon={CheckCircle2} label={t("learnedToday")} value={stats.learnedToday} tone="success" />
              <Metric icon={RefreshCcw} label={t("reviewedToday")} value={stats.reviewedToday} tone="accent" />
              <Metric icon={CalendarClock} label={t("tomorrowDue")} value={stats.tomorrowDue} tone="warning" />
              <Metric icon={ShieldCheck} label={t("relearnCount")} value={stats.relearnCount} tone="danger" />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="card p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("retention")}</h2>
                <div className="text-3xl font-black">
                  {stats.retentionRate === null ? "—" : `${stats.retentionRate}%`}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-strong">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${stats.retentionRate ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="card p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("forecast")}</h2>
                <div className="grid grid-cols-2 gap-2">
                  <Forecast label={t("day7")} value={stats.forecast.day7} />
                  <Forecast label={t("day30")} value={stats.forecast.day30} />
                  <Forecast label={t("day90")} value={stats.forecast.day90} />
                  <Forecast label={t("day180")} value={stats.forecast.day180} />
                </div>
              </div>

              <div className="card p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("resultCounts")}</h2>
                <div className="space-y-3">
                  {Object.entries(stats.resultCounts).map(([result, value]) => (
                    <div key={result}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold">
                          {result === "FAMILIAR" ? t("familiar") : result === "BLURRY" ? t("blurry") : t("forgot")}
                        </span>
                        <span>{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-panel-strong">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(value / Math.max(1, Object.values(stats.resultCounts).reduce((a, b) => a + b, 0))) * 100}%`,
                            background: resultColors[result],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">{t("stageDistribution")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stageEntries.map(([stage, value]) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-right text-sm font-bold">{stage}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-panel-strong">
                      <div
                        className="h-full rounded bg-accent"
                        style={{ width: `${(value / maxValue(stageEntries.map(([, count]) => count))) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm text-muted">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
                <BarChart3 size={16} /> {t("hourlyDistribution")}
              </h2>
              <div className="grid grid-cols-12 gap-1">
                {hourEntries.map(([hour, value]) => (
                  <div key={hour} className="flex flex-col items-center gap-1" title={`${hour}:00`}>
                    <div className="flex h-32 w-full items-end rounded bg-panel-strong">
                      <div
                        className="w-full rounded bg-accent"
                        style={{
                          height: `${Math.max(4, (value / maxValue(hourEntries.map(([, count]) => count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted">{hour}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </RequireAuth>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  tone: "success" | "accent" | "warning" | "danger";
}) {
  const tones = {
    success: "text-success",
    accent: "text-accent",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <div className="card p-4">
      <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${tones[tone]}`}>
        <Icon size={16} /> {label}
      </div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}

function Forecast({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-panel-strong p-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}
