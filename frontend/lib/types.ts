export type UiLanguage = "ZH" | "EN";
export type ThemeMode = "SYSTEM" | "LIGHT" | "DARK";

export interface Settings {
  userId: number;
  refreshTime: string;
  language: UiLanguage;
  theme: ThemeMode;
}

export interface User {
  id: number;
  email: string;
  settings: Settings;
}

export interface RegistrationStatus {
  enabled: boolean;
  inviteRequired: boolean;
}

export interface Deck {
  id: number;
  name: string;
  newCount: number;
  relearnCount: number;
  dueCount: number;
  createdAt: string;
}

export interface Card {
  id: number;
  deckId: number;
  front: string;
  back: string;
  position: number;
  status: "new" | "review" | "relearn" | "graduated";
  stage: number;
  relearnMode: "NONE" | "FORGOT" | "BLURRY";
  relearnCorrectCount: number;
  dueDate: string | null;
  stateVersion: number;
  createdAt: string;
}

export interface CardList {
  items: Card[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Queue {
  deckId: number;
  type: "LEARN" | "REVIEW";
  cardIds: number[];
}

export type AnswerResult = "FAMILIAR" | "BLURRY" | "FORGOT";

export interface AnswerResponse {
  cardId: number;
  nextCardId: number | null;
  queue: number[];
  completed: boolean;
  requiresConfirmation: boolean;
}

export interface DeckOption {
  id: number;
  name: string;
  deleted: boolean;
}

export interface Statistics {
  learningDay: string;
  learnedToday: number;
  reviewedToday: number;
  tomorrowDue: number;
  relearnCount: number;
  stageDistribution: Record<string, number>;
  resultCounts: Record<string, number>;
  retentionRate: number | null;
  hourlyDistribution: Record<string, number>;
  forecast: {
    day7: number;
    day30: number;
    day90: number;
    day180: number;
  };
  deckOptions: DeckOption[];
}
