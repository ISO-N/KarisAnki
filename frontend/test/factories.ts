import type {
  Card,
  Deck,
  Settings,
  Statistics,
  User,
} from "@/lib/types";

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    userId: 1,
    refreshTime: "04:00:00",
    language: "EN",
    theme: "SYSTEM",
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: "user@example.com",
    settings: makeSettings(),
    ...overrides,
  };
}

export function makeDeck(id: number, name = `Deck ${id}`, overrides: Partial<Deck> = {}): Deck {
  return {
    id,
    name,
    newCount: 0,
    relearnCount: 0,
    learnRelearnCount: 0,
    reviewRelearnCount: 0,
    dueCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeCard(id: number, overrides: Partial<Card> = {}): Card {
  return {
    id,
    deckId: 1,
    front: `Front ${id}`,
    back: `Back ${id}`,
    phonetic: null,
    position: id,
    status: "new",
    stage: -1,
    relearnMode: "NONE",
    relearnCorrectCount: 0,
    dueDate: null,
    stateVersion: 1,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeStatistics(overrides: Partial<Statistics> = {}): Statistics {
  return {
    learningDay: "2026-01-01",
    learnedToday: 2,
    reviewedToday: 3,
    tomorrowDue: 4,
    relearnCount: 1,
    stageDistribution: { "-1": 1, "0": 2 },
    resultCounts: { FAMILIAR: 3, BLURRY: 2, FORGOT: 1 },
    retentionRate: 66,
    hourlyDistribution: { "8": 1, "20": 2 },
    forecast: { day7: 10, day30: 20, day90: 30, day180: 40 },
    deckOptions: [
      { id: 1, name: "Active", deleted: false },
      { id: 2, name: "Archived", deleted: true },
    ],
    ...overrides,
  };
}
