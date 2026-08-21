import type { Deck } from "@/lib/types";

export function deckLearnCount(deck: Deck): number {
  return deck.newCount + (deck.learnRelearnCount ?? 0);
}

export function deckReviewCount(deck: Deck): number {
  return deck.dueCount + (deck.reviewRelearnCount ?? 0);
}

export function filterLearnDecks(decks: Deck[]): Deck[] {
  return decks.filter((deck) => deckLearnCount(deck) > 0);
}

export function filterReviewDecks(decks: Deck[]): Deck[] {
  return decks.filter((deck) => deckReviewCount(deck) > 0);
}
