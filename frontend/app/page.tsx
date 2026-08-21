"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Layers, Settings } from "lucide-react";
import { clientTimezone } from "@/lib/api";
import { apiCacheKey, writeApiCache } from "@/lib/api-cache";
import { useAuth } from "@/lib/auth-context";
import { readCachedUser } from "@/lib/user-cache";
import { useApiData } from "@/lib/use-api-data";
import { DashboardToday } from "@/components/dashboard-today";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BootstrapResponse, Deck } from "@/lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { applyAuthenticatedUser } = useAuth();

  useEffect(() => {
    const handleUnauthorized = () => router.replace("/login");
    window.addEventListener("karisanki:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("karisanki:unauthorized", handleUnauthorized);
  }, [router]);

  const bootstrapPath = `/api/bootstrap?timezone=${encodeURIComponent(clientTimezone())}`;
  const [scopeUserId] = useState<number | "guest">(() => readCachedUser()?.id ?? "guest");
  const { data, loading, error, refresh } = useApiData<BootstrapResponse>({
    path: bootstrapPath,
    auth: "optional",
    scopeUserId,
    onData: (bootstrap) => {
      if (scopeUserId === "guest") {
        const key = apiCacheKey(bootstrap.user.id, "GET", bootstrapPath);
        void writeApiCache(key, bootstrap.user.id, "GET", bootstrapPath, bootstrap);
      }
      applyAuthenticatedUser(bootstrap.user);
    },
  });

  const decks: Deck[] = data?.decks ?? [];


  return (
    <div className="dashboard-viewport flex flex-col gap-6">
      <PageHeader title={t("dashboard")} description={t("today")} />

      {loading ? (
        <Skeleton className="h-48" />
      ) : error ? (
        <ErrorState title={t("error")} description={error} onRetry={refresh} retryLabel={t("retry")} />
      ) : (
        <DashboardToday
          decks={decks}
          decksHref="/decks"
          continueLearningLabel={t("continueLearning")}
          continueReviewLabel={t("continueReview")}
          emptyTitle={t("dashboardEmpty")}
          emptyDescription={t("dashboardEmptyHint")}
          goToDecksLabel={t("goToDecks")}
          createDeckLabel={t("createDeck")}
          createCardLabel={t("createCard")}
          newLabel={t("newCards")}
          relearnLabel={t("relearn")}
          dueLabel={t("due")}
          todayLabel={t("today")}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/decks" className={cn("group p-0")}>
          <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="flex flex-col gap-2 p-0">
              <Layers className="size-5 text-primary" aria-hidden="true" />
              <span className="font-medium">{t("decks")}</span>
              <span className="text-sm text-muted-foreground">{decks.length} {t("decks")}</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/statistics" className="group p-0">
          <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="flex flex-col gap-2 p-0">
              <BarChart3 className="size-5 text-primary" aria-hidden="true" />
              <span className="font-medium">{t("statistics")}</span>
              <span className="text-sm text-muted-foreground">{t("forecast")}</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings" className="group p-0">
          <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="flex flex-col gap-2 p-0">
              <Settings className="size-5 text-primary" aria-hidden="true" />
              <span className="font-medium">{t("settings")}</span>
              <span className="text-sm text-muted-foreground">{t("refreshTime")}</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
