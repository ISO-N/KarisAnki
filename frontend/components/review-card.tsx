"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import { PronunciationButton } from "@/components/pronunciation-button";
import type { Card as StudyCard } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReviewPhase = "front" | "answer" | "submitting" | "leaving" | "entering" | "graduate" | "confirmForget" | "loading";

interface ReviewCardProps {
  card: StudyCard;
  phase: ReviewPhase;
  statusLabel: string;
  stageLabel: string;
  familiarProgressLabel?: string;
  frontLabel: string;
  backLabel: string;
  pronunciationLabel?: string;
}

export function ReviewCard({ card, phase, statusLabel, stageLabel, familiarProgressLabel, frontLabel, backLabel, pronunciationLabel = "Play pronunciation" }: ReviewCardProps) {
  const revealed = phase !== "front";
  const statusTone =
    card.status === "relearn" ? "warning" : card.status === "new" ? "primary" : "success";

  return (
    <Card className="relative flex min-h-[52vh] flex-1 flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <Badge variant={statusTone}>{statusLabel}</Badge>
          <div className="flex items-center gap-2">
            {familiarProgressLabel ? (
              <span className="font-mono text-xs text-muted-foreground">{familiarProgressLabel}</span>
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">{stageLabel}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <div
              className={cn(
                "transition-[opacity] duration-200",
                revealed ? "opacity-80" : "opacity-100",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">{frontLabel}</div>
                <PronunciationButton front={card.front} label={pronunciationLabel} />
              </div>
              <div className="markdown-body--centered">
                <MarkdownContent content={card.front} />
              </div>
              {card.phonetic ? (
                <div className="mt-2 text-center text-sm text-muted-foreground">/{card.phonetic}/</div>
              ) : null}
            </div>

            {revealed ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="border-t pt-6"
              >
                <div className="mb-2 text-xs font-medium text-primary">{backLabel}</div>
                <div className="markdown-body--centered">
                  <MarkdownContent content={card.back} />
                </div>
              </motion.div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
