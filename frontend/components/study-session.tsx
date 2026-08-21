"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability -- queue loading and skipped-card recursion are external data syncs */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Eye, LoaderCircle, RotateCcw } from "lucide-react";
import { api, ApiError, apiErrorMessage, clientTimezone } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { useI18n } from "@/lib/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RatingBar } from "@/components/rating-bar";
import { ReviewCard } from "@/components/review-card";
import { SessionHeader } from "@/components/session-header";
import { cn } from "@/lib/utils";
import type { AnswerResponse, AnswerResult, Card as StudyCard, Queue } from "@/lib/types";

type Phase =
  | "loading"
  | "front"
  | "answer"
  | "submitting"
  | "leaving"
  | "entering"
  | "graduate"
  | "confirmForget"
  | "done"
  | "error";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function StudySession({ deckId, type }: { deckId: number; type: "LEARN" | "REVIEW" }) {
  const { t, language } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");
  const [queue, setQueue] = useState<number[]>([]);
  const [card, setCard] = useState<StudyCard | null>(null);
  const [selected, setSelected] = useState<AnswerResult | null>(null);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  const loadCard = useCallback(async (cardId: number, candidates: number[] = [], transition = false) => {
    try {
      const next = await api<StudyCard>(`/api/cards/${cardId}`);
      setCard(next);
      if (transition) {
        setPhase("entering");
        await wait(160);
      }
      setPhase("front");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        if (candidates.length > 1) {
          const nextCandidates = candidates.slice(1);
          setQueue(nextCandidates);
          return loadCard(nextCandidates[0], nextCandidates, false);
        }
        setQueue([]);
        setCard(null);
        setPhase("done");
        return false;
      }
      throw err;
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const data = await api<Queue>(
        `/api/decks/${deckId}/queue?type=${type}&timezone=${encodeURIComponent(clientTimezone())}`,
      );
      setQueue(data.cardIds);
      setTotal(data.cardIds.length);
      setSelected(null);
      if (data.cardIds.length === 0) {
        setCard(null);
        setPhase("done");
        return;
      }
      await loadCard(data.cardIds[0], data.cardIds, true);
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
      setPhase("error");
    }
  }, [deckId, type, loadCard, language, t]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const submit = useCallback(
    async (result: AnswerResult, extra?: { graduate?: boolean; confirmForget?: boolean }) => {
      if (!card || phase === "submitting" || phase === "leaving") return;
      setSelected(result);
      setPhase("submitting");
      try {
        const response = await api<AnswerResponse>("/api/answer", {
          method: "POST",
          body: JSON.stringify({
            cardId: card.id,
            result,
            queueType: type,
            timezone: clientTimezone(),
            stateVersion: card.stateVersion,
            graduate: extra?.graduate ?? false,
            confirmForget: extra?.confirmForget ?? false,
          }),
        });
        setQueue(response.queue);
        if (response.queue.length === 0) {
          setCard(null);
          setPhase("done");
          return;
        }
        setPhase("leaving");
        await wait(140);
        await loadCard(response.queue[0], response.queue, true);
        setSelected(null);
      } catch (err) {
        if (err instanceof ApiError && err.code === "confirmation_required") {
          setPhase("confirmForget");
          setSelected(null);
          return;
        }
        if (err instanceof ApiError && (err.code === "queue_conflict" || err.code === "queue_refresh")) {
          setError(apiErrorMessage(err, language, t("error")));
          setPhase("error");
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setError(apiErrorMessage(err, language, t("error")));
          setPhase("error");
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          setError(t("sessionExpired"));
          setPhase("error");
          return;
        }
        setError(apiErrorMessage(err, language, t("error")));
        setPhase("error");
      }
    },
    [card, type, loadCard, language, phase, t],
  );

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
      void submit(result);
    },
    [card, phase, submit],
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
      if (phase === "answer" && event.key === "1") chooseResult("FAMILIAR");
      if (phase === "answer" && event.key === "2") chooseResult("BLURRY");
      if (phase === "answer" && event.key === "3") chooseResult("FORGOT");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, chooseResult]);

  const remaining = useMemo(() => Math.max(0, queue.length), [queue.length]);
  const statusLabel = phase === "loading" ? t("queueLoading") : type === "LEARN" ? t("startLearn") : t("startReview");

  return (
    <RequireAuth>
      <div className="review-viewport">
        <SessionHeader
          backHref={`/decks/${deckId}`}
          backLabel={t("back")}
          progressLabel={t("progressLabel")}
          remaining={remaining}
          total={total}
          statusLabel={statusLabel}
        />

        {phase === "loading" ? (
          <Skeleton className="min-h-[52vh] flex-1" />
        ) : null}

        {phase === "error" ? (
          <ErrorState
            title={t("error")}
            description={error}
            onRetry={loadQueue}
            retryLabel={t("retry")}
          />
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
            <Button variant="outline" onClick={loadQueue} className="min-h-11">
              <RotateCcw data-icon="inline-start" />
              {t("startAgain")}
            </Button>
          </EmptyState>
        ) : null}

        {card && phase !== "done" && phase !== "error" ? (
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

              {phase === "leaving" || phase === "entering" ? (
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
