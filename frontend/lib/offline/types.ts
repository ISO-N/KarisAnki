import type { AnswerResult, Card, StudySession } from "@/lib/types";

export type StudyQueueType = "LEARN" | "REVIEW";

export type OutboxStatus = "PENDING" | "CONFLICTED";

export interface OutboxEntry {
  clientAnswerId: string;
  sessionKey: string;
  cardId: number;
  result: AnswerResult;
  queueType: StudyQueueType;
  timezone: string;
  stateVersion: number;
  previousClientAnswerId: string | null;
  graduate: boolean;
  confirmForget: boolean;
  reinserted?: boolean;
  status: OutboxStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
}

export interface StoredSession {
  key: string;
  deckId: number;
  type: StudyQueueType;
  timezone: string;
  order: number[];
  cards: Card[];
  total: number;
  completedCount: number;
  lastSyncedAt: string | null;
  lastClientAnswerIds: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface LocalQueueMutationResult {
  order: number[];
  cards: Card[];
  card: Card | null;
  reinserted: boolean;
  requiresConfirmation: boolean;
}

export function sessionKey(deckId: number, type: StudyQueueType) {
  return `${deckId}:${type}`;
}

export function toStoredSession(session: StudySession): StoredSession {
  const now = new Date().toISOString();
  return {
    key: sessionKey(session.deckId, session.type),
    deckId: session.deckId,
    type: session.type,
    timezone: session.timezone,
    order: [...session.order],
    cards: session.cards.map((card) => ({ ...card, phonetic: card.phonetic ?? null })),
    total: session.total,
    completedCount: 0,
    lastSyncedAt: now,
    lastClientAnswerIds: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function fromStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as Partial<StoredSession>;
  if (
    typeof stored.key !== "string" ||
    typeof stored.deckId !== "number" ||
    (stored.type !== "LEARN" && stored.type !== "REVIEW") ||
    typeof stored.timezone !== "string" ||
    !Array.isArray(stored.order) ||
    !Array.isArray(stored.cards) ||
    typeof stored.total !== "number" ||
    typeof stored.completedCount !== "number"
  ) {
    return null;
  }
  if (!stored.lastClientAnswerIds || typeof stored.lastClientAnswerIds !== "object") {
    stored.lastClientAnswerIds = {};
  }
  const cards = stored.cards.map((card) => ({ ...card, phonetic: card.phonetic ?? null }));
  return { ...stored, cards } as StoredSession;
}
