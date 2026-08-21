"use client";

import Link from "next/link";
import { BookOpen, CalendarClock, Layers, RefreshCcw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

interface DashboardTodayProps {
  newCount: number;
  relearnCount: number;
  dueCount: number;
  learnHref: string;
  reviewHref: string;
  decksHref: string;
  continueLearningLabel: string;
  continueReviewLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  goToDecksLabel: string;
  createDeckLabel: string;
  createCardLabel: string;
  newLabel: string;
  relearnLabel: string;
  dueLabel: string;
  todayLabel: string;
}

export function DashboardToday({
  newCount,
  relearnCount,
  dueCount,
  learnHref,
  reviewHref,
  decksHref,
  continueLearningLabel,
  continueReviewLabel,
  emptyTitle,
  emptyDescription,
  goToDecksLabel,
  createDeckLabel,
  createCardLabel,
  newLabel,
  relearnLabel,
  dueLabel,
  todayLabel,
}: DashboardTodayProps) {
  const hasTasks = newCount > 0 || relearnCount > 0 || dueCount > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{todayLabel}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="primary">
                <Layers data-icon="inline-start" aria-hidden="true" />
                {newLabel} {newCount}
              </Badge>
              <Badge variant="warning">
                <RefreshCcw data-icon="inline-start" aria-hidden="true" />
                {relearnLabel} {relearnCount}
              </Badge>
              <Badge variant="success">
                <CalendarClock data-icon="inline-start" aria-hidden="true" />
                {dueLabel} {dueCount}
              </Badge>
            </div>
          </div>
          {hasTasks ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {newCount > 0 || relearnCount > 0 ? (
                <Link
                  href={learnHref}
                  className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
                >
                  <BookOpen data-icon="inline-start" />
                  {continueLearningLabel}
                </Link>
              ) : null}
              {dueCount > 0 || relearnCount > 0 ? (
                <Link
                  href={reviewHref}
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
                >
                  <BookOpen data-icon="inline-start" />
                  {continueReviewLabel}
                </Link>
              ) : null}
            </div>
          ) : (
            <Link
              href={decksHref}
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              <Layers data-icon="inline-start" />
              {goToDecksLabel}
            </Link>
          )}
        </div>

        {!hasTasks ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            className="border-0 bg-transparent p-0"
          >
            <div className="flex flex-wrap gap-2">
              <Link href={decksHref} className={cn(buttonVariants(), "min-h-11")}>
                <Layers data-icon="inline-start" aria-hidden="true" />
                {createDeckLabel}
              </Link>
              <Link href={decksHref} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
                <BookOpen data-icon="inline-start" aria-hidden="true" />
                {createCardLabel}
              </Link>
              <Link href={decksHref} className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}>
                {goToDecksLabel}
              </Link>
            </div>
          </EmptyState>
        ) : null}
      </CardContent>
    </Card>
  );
}
