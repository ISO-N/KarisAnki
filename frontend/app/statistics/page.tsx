"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount is an external data sync */

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarClock, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import type { Statistics } from "@/lib/types";

function maxValue(values: number[]) {
  return Math.max(1, ...values);
}

export default function StatisticsPage() {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [deckId, setDeckId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (selectedDeckId: string) => {
      const query = selectedDeckId && selectedDeckId !== "all" ? `&deckId=${selectedDeckId}` : "";
      try {
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
    },
    [language, t],
  );

  useEffect(() => {
    load(deckId);
  }, [deckId, load]);

  if (loading && !stats) {
    return (
      <RequireAuth>
        <div className="dashboard-viewport flex min-h-[50vh] flex-col gap-4">
          <PageHeader title={t("statistics")} description={t("loading")} />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </RequireAuth>
    );
  }

  const stageEntries = stats ? Object.entries(stats.stageDistribution) : [];
  const hourEntries = stats ? Object.entries(stats.hourlyDistribution) : [];
  const deckItems = {
    all: t("allDecks"),
    ...Object.fromEntries(
      (stats?.deckOptions ?? []).map((deck) => [
        String(deck.id),
        `${deck.name}${deck.deleted ? ` (${t("deletedDeck")})` : ""}`
      ]),
    ),
  };

  return (
    <RequireAuth>
      <div className="dashboard-viewport flex flex-col gap-6">
        <PageHeader
          title={t("statistics")}
          description={stats?.learningDay}
          actions={
            <Select value={deckId} onValueChange={(value) => setDeckId(String(value))} items={deckItems}>
              <SelectTrigger className="min-w-44" aria-label={t("allDecks")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allDecks")}</SelectItem>
                {stats?.deckOptions.map((deck) => (
                  <SelectItem key={deck.id} value={String(deck.id)}>
                    {deck.name} {deck.deleted ? `(${t("deletedDeck")})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {error && !stats ? (
          <ErrorState title={t("error")} description={error} onRetry={() => load(deckId)} retryLabel={t("retry")} />
        ) : !stats ? (
          <EmptyState title={t("emptyStatistics")} />
        ) : (
          <>
            {error ? <ErrorState title={t("error")} description={error} onRetry={() => load(deckId)} retryLabel={t("retry")} /> : null}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard icon={CheckCircle2} label={t("learnedToday")} value={stats.learnedToday} tone="success" />
              <MetricCard icon={RefreshCcw} label={t("reviewedToday")} value={stats.reviewedToday} tone="primary" />
              <MetricCard icon={CalendarClock} label={t("tomorrowDue")} value={stats.tomorrowDue} tone="warning" />
              <MetricCard icon={ShieldCheck} label={t("relearnCount")} value={stats.relearnCount} tone="danger" />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="p-4">
                <CardHeader>
                  <CardTitle>{t("retention")}</CardTitle>
                  <CardDescription>{t("resultCounts")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-0">
                  <div className="font-mono text-3xl font-semibold tabular-nums">
                    {stats.retentionRate === null ? "—" : `${stats.retentionRate}%`}
                  </div>
                  <Progress value={stats.retentionRate ?? 0} className="w-full" />
                </CardContent>
              </Card>

              <Card className="p-4">
                <CardHeader>
                  <CardTitle>{t("forecast")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 p-0">
                  <Forecast label={t("day7")} value={stats.forecast.day7} />
                  <Forecast label={t("day30")} value={stats.forecast.day30} />
                  <Forecast label={t("day90")} value={stats.forecast.day90} />
                  <Forecast label={t("day180")} value={stats.forecast.day180} />
                </CardContent>
              </Card>

              <Card className="p-4">
                <CardHeader>
                  <CardTitle>{t("resultCounts")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-0">
                  {Object.entries(stats.resultCounts).map(([result, value]) => (
                    <div key={result}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {result === "FAMILIAR" ? t("familiar") : result === "BLURRY" ? t("blurry") : t("forgot")}
                        </span>
                        <span className="font-mono tabular-nums">{value}</span>
                      </div>
                      <Progress
                        value={(value / Math.max(1, Object.values(stats.resultCounts).reduce((a, b) => a + b, 0))) * 100}
                        className="w-full"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="p-4">
              <CardHeader>
                <CardTitle>{t("stageDistribution")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {stageEntries.map(([stage, value]) => (
                  <div key={stage} className="flex items-center gap-3">
                    <Badge variant="outline" className="w-12 justify-center font-mono">
                      {stage}
                    </Badge>
                    <Progress value={(value / maxValue(stageEntries.map(([, count]) => count))) * 100} className="flex-1" />
                    <span className="w-8 text-right font-mono text-sm text-muted-foreground">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" aria-hidden="true" />
                  {t("hourlyDistribution")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-12 gap-1 p-0">
                {hourEntries.map(([hour, value]) => (
                  <div key={hour} className="flex flex-col items-center gap-1">
                    <div className="flex h-32 w-full items-end rounded bg-panel-strong">
                      <div
                        className="w-full rounded bg-primary"
                        style={{
                          height: `${Math.max(4, (value / maxValue(hourEntries.map(([, count]) => count))) * 100)}%`,
                        }}
                        role="img"
                        aria-label={`${hour}:00 · ${value}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{hour}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RequireAuth>
  );
}

function Forecast({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-panel-strong p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
