import { describe, expect, it } from "vitest";
import { filterLearnDecks, filterReviewDecks } from "./dashboard-decks";
import type { Deck } from "@/lib/types";

function deck(id: number, counts: Partial<Pick<Deck, "newCount" | "relearnCount" | "learnRelearnCount" | "reviewRelearnCount" | "dueCount">> = {}): Deck {
  return {
    id,
    name: `Deck ${id}`,
    newCount: 0,
    relearnCount: 0,
    learnRelearnCount: 0,
    reviewRelearnCount: 0,
    dueCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...counts,
  };
}

describe("dashboard deck filters", () => {
  it("includes new cards and learning relearn in the learn list", () => {
    const decks = [
      deck(1, { newCount: 2 }),
      deck(2, { learnRelearnCount: 1 }),
      deck(3, { reviewRelearnCount: 1 }),
    ];

    expect(filterLearnDecks(decks).map((item) => item.id)).toEqual([1, 2]);
  });

  it("includes due reviews and review relearn in the review list", () => {
    const decks = [
      deck(1, { dueCount: 2 }),
      deck(2, { reviewRelearnCount: 1 }),
      deck(3, { learnRelearnCount: 1 }),
    ];

    expect(filterReviewDecks(decks).map((item) => item.id)).toEqual([1, 2]);
  });

  it("does not include a learning relearn deck in the review list", () => {
    const decks = [deck(1, { learnRelearnCount: 3 })];

    expect(filterReviewDecks(decks)).toEqual([]);
  });
});
