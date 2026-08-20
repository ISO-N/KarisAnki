"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability -- queue loading and skipped-card recursion are external data syncs */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Eye, RotateCcw, Sparkles } from "lucide-react";
import { api, ApiError, apiErrorMessage, clientTimezone } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { MarkdownContent } from "@/components/markdown-content";
import { useI18n } from "@/lib/i18n";
import type { AnswerResponse, AnswerResult, Card, Queue } from "@/lib/types";

type Phase = "loading" | "front" | "answer" | "graduate" | "confirmForget" | "done" | "error";

export function StudySession({ deckId, type }: { deckId: number; type: "LEARN" | "REVIEW" }) {
  const { t, language } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");
  const [queue, setQueue] = useState<number[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const loadCard = useCallback(async (cardId: number, candidates: number[] = []) => {
    try {
      const next = await api<Card>(`/api/cards/${cardId}`);
      setCard(next);
      setPhase("front");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        if (candidates.length > 1) {
          const nextCandidates = candidates.slice(1);
          setQueue(nextCandidates);
          return loadCard(nextCandidates[0], nextCandidates);
        }
        setQueue([]);
        setPhase("done");
        return false;
      }
      throw err;
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const data = await api<Queue>(
        `/api/decks/${deckId}/queue?type=${type}&timezone=${encodeURIComponent(clientTimezone())}`,
      );
      setQueue(data.cardIds);
      setTotal(data.cardIds.length);
      if (data.cardIds.length === 0) {
        setPhase("done");
        return;
      }
      await loadCard(data.cardIds[0], data.cardIds);
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
      if (!card || submitting) return;
      setSubmitting(true);
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
          setPhase("done");
          return;
        }
        await loadCard(response.queue[0], response.queue);
      } catch (err) {
        if (err instanceof ApiError && err.code === "confirmation_required") {
          setPhase("confirmForget");
          return;
        }
        if (err instanceof ApiError && (err.code === "queue_conflict" || err.code === "queue_refresh")) {
          setPhase("loading");
          await loadQueue();
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setPhase("loading");
          await loadQueue();
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          setError(t("sessionExpired"));
          setPhase("error");
          return;
        }
        setError(apiErrorMessage(err, language, t("error")));
        setPhase("error");
      } finally {
        setSubmitting(false);
      }
    },
    [card, type, loadCard, loadQueue, language, submitting, t],
  );

  const chooseResult = useCallback(
    (result: AnswerResult) => {
      if (!card) return;
      if (result === "FAMILIAR" && card.stage === 8 && card.status !== "relearn") {
        setPhase("graduate");
        return;
      }
      if (result === "FORGOT" && card.status === "relearn" && card.relearnMode === "BLURRY") {
        setPhase("confirmForget");
        return;
      }
      submit(result);
    },
    [card, submit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        if (phase === "front") {
          event.preventDefault();
          setPhase("answer");
        }
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

  return (
    <RequireAuth>
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`/decks/${deckId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
            <ChevronLeft size={16} /> {t("back")}
          </Link>
          <span className="text-sm font-semibold text-muted">
            {phase === "done" ? t("queueDone") : `${remaining} / ${total}`}
          </span>
        </div>

        {phase === "loading" && (
          <div className="flex flex-1 items-center justify-center text-muted">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent" />
          </div>
        )}

        {phase === "done" && (
          <div className="empty my-auto">
            <Sparkles className="mx-auto mb-3 text-accent" size={28} />
            <h2 className="text-lg font-bold text-foreground">{t("queueDone")}</h2>
            <p className="mt-1 text-sm">{t("queueEmpty")}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href={`/decks/${deckId}`} className="btn btn-primary">{t("back")}</Link>
              <button className="btn btn-secondary" onClick={loadQueue}>
                <RotateCcw size={16} /> {t("reset")}
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="empty my-auto">
            <h2 className="text-lg font-bold text-foreground">{t("error")}</h2>
            <p className="mt-1 text-sm">{error}</p>
            <button className="btn btn-primary mt-4" onClick={loadQueue}>{t("reset")}</button>
          </div>
        )}

        {(phase === "front" || phase === "answer" || phase === "graduate" || phase === "confirmForget") && card && (
          <>
            <div className="card flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
                <span className={`badge ${card.status === "relearn" ? "badge-warning" : card.status === "new" ? "badge-accent" : "badge-success"}`}>
                  {type === "LEARN" ? t("startLearn") : t("startReview")}
                </span>
                <span className="badge">{t("stage")} {card.stage}</span>
              </div>
              <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10">
                <div className="mx-auto w-full max-w-2xl">
                  {phase === "front" ? (
                    <MarkdownContent content={card.front} />
                  ) : (
                    <div className="space-y-8">
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t("front")}</div>
                        <MarkdownContent content={card.front} />
                      </div>
                      <div className="border-t border-line pt-6">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{t("backSide")}</div>
                        <MarkdownContent content={card.back} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              {phase === "front" && (
                <button className="btn btn-primary h-14 w-full text-base" onClick={() => setPhase("answer")}>
                  <Eye size={18} /> {t("flip")}
                </button>
              )}

              {phase === "answer" && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button className="btn btn-success h-14 text-sm sm:text-base" onClick={() => chooseResult("FAMILIAR")}>
                    1 · {t("familiar")}
                  </button>
                  <button className="btn btn-warning h-14 text-sm sm:text-base" onClick={() => chooseResult("BLURRY")}>
                    2 · {t("blurry")}
                  </button>
                  <button className="btn btn-danger h-14 text-sm sm:text-base" onClick={() => chooseResult("FORGOT")}>
                    3 · {t("forgot")}
                  </button>
                </div>
              )}

              {phase === "graduate" && (
                <div className="card space-y-3 p-4">
                  <h2 className="text-base font-bold">{t("stage")} 8</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button className="btn btn-success" onClick={() => submit("FAMILIAR", { graduate: true })}>
                      {t("graduate")}
                    </button>
                    <button className="btn btn-secondary" onClick={() => submit("FAMILIAR", { graduate: false })}>
                      {t("continueReview")}
                    </button>
                  </div>
                </div>
              )}

              {phase === "confirmForget" && (
                <div className="card space-y-3 p-4">
                  <h2 className="text-base font-bold">{t("confirmForget")}</h2>
                  <p className="text-sm text-muted">{t("confirmForgetHint")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-danger" onClick={() => submit("FORGOT", { confirmForget: true })}>
                      {t("confirmForget")}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setPhase("answer")}>
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
