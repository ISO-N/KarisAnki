"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarClock, Layers, RefreshCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deckLearnCount,
  deckReviewCount,
  filterLearnDecks,
  filterReviewDecks,
} from "@/lib/dashboard-decks";
import { cn } from "@/lib/utils";
import type { Deck } from "@/lib/types";

interface DashboardTodayProps {
  decks: Deck[];
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
  decks,
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
  const router = useRouter();
  const newCount = decks.reduce((sum, deck) => sum + deck.newCount, 0);
  const relearnCount = decks.reduce((sum, deck) => sum + deck.relearnCount, 0);
  const dueCount = decks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const learnDecks = filterLearnDecks(decks);
  const reviewDecks = filterReviewDecks(decks);
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
              {learnDecks.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button size="lg" className="min-h-11" />}>
                    <BookOpen data-icon="inline-start" />
                    {continueLearningLabel}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 w-64">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{continueLearningLabel}</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {learnDecks.map((deck) => (
                      <DropdownMenuItem
                        key={deck.id}
                        onClick={() => router.push(`/decks/${deck.id}/learn`)}
                      >
                        <span className="min-w-0 flex-1 truncate">{deck.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {deckLearnCount(deck)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {reviewDecks.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="lg" className="min-h-11" />}
                  >
                    <BookOpen data-icon="inline-start" />
                    {continueReviewLabel}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 w-64">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{continueReviewLabel}</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {reviewDecks.map((deck) => (
                      <DropdownMenuItem
                        key={deck.id}
                        onClick={() => router.push(`/decks/${deck.id}/review`)}
                      >
                        <span className="min-w-0 flex-1 truncate">{deck.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {deckReviewCount(deck)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
