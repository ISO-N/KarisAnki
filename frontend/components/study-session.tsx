"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  CircleAlert,
  Cloud,
  CloudUpload,
  Eye,
  History,
  LoaderCircle,
  RotateCcw,
  WifiOff,
} from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { useI18n } from "@/lib/i18n";
import { relearnProgressLabel } from "@/lib/relearn-progress";
import { useOfflineSession, type SyncStatus } from "@/lib/offline/session-sync";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RatingBar } from "@/components/rating-bar";
import { ReviewCard } from "@/components/review-card";
import { SessionHeader } from "@/components/session-header";
import { cn } from "@/lib/utils";
import type { AnswerResult } from "@/lib/types";

function SyncStatusBar({
  status,
  pendingCount,
  online,
}: {
  status: SyncStatus;
  pendingCount: number;
  online: boolean;
}) {
  const { t } = useI18n();
  const Icon =
    status === "offline"
      ? WifiOff
      : status === "syncing"
        ? LoaderCircle
        : status === "conflict"
          ? CircleAlert
          : status === "pending"
            ? CloudUpload
            : Cloud;

  const label =
    status === "offline"
      ? t("offline")
      : status === "pending"
        ? t("pendingSync")
        : status === "syncing"
          ? t("syncing")
          : status === "synced"
            ? t("synced")
            : status === "conflict"
              ? t("conflict")
              : online
                ? t("synced")
                : t("offline");

  return (
    <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2" aria-live="polite">
        <Icon className={cn("size-4", status === "syncing" && "animate-spin")} aria-hidden="true" />
        {label}
      </span>
      {pendingCount > 0 ? (
        <span className="font-mono text-xs tabular-nums">
          {t("pendingSyncCount")} {pendingCount}
        </span>
      ) : null}
    </div>
  );
}

export function StudySession({ deckId, type }: { deckId: number; type: "LEARN" | "REVIEW" }) {
  const { t } = useI18n();
  const {
    session,
    phase,
    card,
    error,
    syncStatus,
    pendingCount,
    online,
    resume,
    refresh,
    discardLocalAndRefresh,
    continueAfterConflict,
    submit,
    setPhase,
  } = useOfflineSession(deckId, type);
  const [selected, setSelected] = useState<AnswerResult | null>(null);

  useEffect(() => {
    if (phase === "leaving") {
      const timeout = window.setTimeout(() => setPhase("front"), 140);
      return () => window.clearTimeout(timeout);
    }
  }, [phase, setPhase]);

  const chooseResult = useCallback(
    (result: AnswerResult) => {
      if (!card || phase === "submitting" || phase === "leaving") return;
      if (result === "FAMILIAR" && card.stage === 8 && card.status !== "relearn") {
        setSelected(result);
        setPhase("graduate");
        return;
      }
      if (result === "FORGOT" && card.status === "relearn" && card.relearnMode === "BLURRY") {
        setSelected(result);
        setPhase("confirmForget");
        return;
      }
      setSelected(result);
      void submit(result);
    },
    [card, phase, setPhase, submit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.key === " " || event.code === "Space") && phase === "front") {
        event.preventDefault();
        setPhase("answer");
        return;
      }
      if (phase === "answer" && event.key === "1") chooseResult("FORGOT");
      if (phase === "answer" && event.key === "2") chooseResult("BLURRY");
      if (phase === "answer" && event.key === "3") chooseResult("FAMILIAR");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, chooseResult, setPhase]);

  const statusLabel = phase === "loading" ? t("queueLoading") : type === "LEARN" ? t("startLearn") : t("startReview");
  const familiarProgressLabel = card?.status === "relearn"
    ? relearnProgressLabel(card.relearnCorrectCount, card.relearnMode, t("familiarProgress"))
    : null;
  const completed = session?.completedCount ?? 0;
  const total = session?.total ?? 0;

  return (
    <RequireAuth>
      <div className="review-viewport">
        <SessionHeader
          backHref={`/decks/${deckId}`}
          backLabel={t("back")}
          progressLabel={t("progressLabel")}
          completed={completed}
          total={total}
          statusLabel={statusLabel}
        />

        {(phase === "front" || phase === "answer" || phase === "submitting" || phase === "leaving" || phase === "graduate" || phase === "confirmForget" || phase === "resume" || phase === "conflict") ? (
          <SyncStatusBar status={syncStatus} pendingCount={pendingCount} online={online} />
        ) : null}

        {phase === "loading" ? <Skeleton className="min-h-[52vh] flex-1" /> : null}

        {phase === "error" ? (
          <ErrorState
            title={t("error")}
            description={error}
            onRetry={refresh}
            retryLabel={t("retry")}
          />
        ) : null}

        {phase === "resume" ? (
          <EmptyState
            icon={<History />}
            title={t("sessionResumeTitle")}
            description={t("sessionResumeHint")}
            className="my-auto"
          >
            <div className="flex flex-wrap gap-2">
              <Button onClick={resume} className="min-h-11">
                {t("resumeSession")}
              </Button>
              <Button variant="outline" onClick={discardLocalAndRefresh} className="min-h-11">
                <RotateCcw data-icon="inline-start" />
                {t("refreshSession")}
              </Button>
            </div>
          </EmptyState>
        ) : null}

        {phase === "conflict" ? (
          <EmptyState
            icon={<CircleAlert />}
            title={t("sessionConflictTitle")}
            description={t("sessionConflictHint")}
            className="my-auto"
          >
            <Button onClick={continueAfterConflict} className="min-h-11">
              {t("resumeSession")}
            </Button>
          </EmptyState>
        ) : null}

        {phase === "done" ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title={t("sessionComplete")}
            description={t("sessionCompleteHint")}
            className="my-auto"
          >
            <Link href={`/decks/${deckId}`} className={cn(buttonVariants(), "min-h-11")}>
              {t("returnToDeck")}
            </Link>
            <Button variant="outline" onClick={refresh} className="min-h-11">
              <RotateCcw data-icon="inline-start" />
              {t("startAgain")}
            </Button>
          </EmptyState>
        ) : null}

        {card && phase !== "done" && phase !== "error" && phase !== "resume" && phase !== "conflict" ? (
          <>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex min-h-[52vh] flex-1 flex-col"
              >
                <ReviewCard
                  card={card}
                  phase={phase}
                  statusLabel={statusLabel}
                  stageLabel={`${t("stage")} ${card.stage}`}
                  familiarProgressLabel={familiarProgressLabel ?? undefined}
                  frontLabel={t("frontLabel")}
                  backLabel={t("backLabel")}
                />
              </motion.div>
            </AnimatePresence>

            <div className="sticky bottom-0 mt-4 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
              {phase === "front" ? (
                <Button className="h-14 w-full text-base" onClick={() => setPhase("answer")}>
                  <Eye data-icon="inline-start" />
                  {t("flip")}
                </Button>
              ) : null}

              {phase === "answer" || phase === "submitting" ? (
                <RatingBar
                  familiarLabel={t("familiar")}
                  blurryLabel={t("blurry")}
                  forgotLabel={t("forgot")}
                  submittingLabel={t("ratingGroup")}
                  submitting={phase === "submitting"}
                  selected={selected}
                  onSelect={chooseResult}
                />
              ) : null}

              {phase === "leaving" ? (
                <div className="flex min-h-14 items-center justify-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  {t("submitting")}
                </div>
              ) : null}

              {phase === "graduate" ? (
                <Card className="p-4">
                  <CardContent className="flex flex-col gap-3 p-0">
                    <h2 className="text-base font-semibold">{t("stage")} 8</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button onClick={() => submit("FAMILIAR", { graduate: true })} className="min-h-11">
                        {t("graduate")}
                      </Button>
                      <Button variant="outline" onClick={() => submit("FAMILIAR", { graduate: false })} className="min-h-11">
                        {t("continueReview")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {phase === "confirmForget" ? (
                <Card className="p-4">
                  <CardContent className="flex flex-col gap-3 p-0">
                    <h2 className="text-base font-semibold">{t("confirmForget")}</h2>
                    <p className="text-sm text-muted-foreground">{t("confirmForgetHint")}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="destructive" onClick={() => submit("FORGOT", { confirmForget: true })} className="min-h-11">
                        {t("confirmForget")}
                      </Button>
                      <Button variant="outline" onClick={() => { setPhase("answer"); setSelected(null); }} className="min-h-11">
                        {t("cancel")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="sr-only" aria-live="polite">
          {selected ? `${t("ratingSubmitted")}: ${selected}` : ""}
        </div>
      </div>
    </RequireAuth>
  );
}
