import type { AnswerResult, Card } from "@/lib/types";
import type { LocalQueueMutationResult, StudyQueueType } from "@/lib/offline/types";

export interface LocalQueueMutationInput {
  order: number[];
  cards: Card[];
  cardId: number;
  result: AnswerResult;
  queueType: StudyQueueType;
  confirmForget?: boolean;
}

function insertRelearn(
  queue: number[],
  cardId: number,
  correctCount: number,
  insertedAtOffset: Map<number, number>,
) {
  const base = Math.min(1 << Math.max(0, correctCount), queue.length);
  const sameOffset = insertedAtOffset.get(base) ?? 0;
  const index = Math.min(base + sameOffset, queue.length);
  queue.splice(index, 0, cardId);
  insertedAtOffset.set(base, sameOffset + 1);
}

export function mutateLocalQueue(input: LocalQueueMutationInput): LocalQueueMutationResult {
  const cards = [...input.cards];
  const cardIndex = cards.findIndex((card) => card.id === input.cardId);
  if (cardIndex === -1) {
    return {
      order: [...input.order],
      cards,
      card: null,
      reinserted: false,
      requiresConfirmation: false,
    };
  }

  const current = cards[cardIndex];
  const queue = input.order.filter((id) => id !== input.cardId);
  const insertedAtOffset = new Map<number, number>();
  let reinserted = false;
  const requiresConfirmation = false;
  let nextCount = current.relearnCorrectCount;
  let nextMode = current.relearnMode;
  let nextStatus = current.status;

  if (current.status === "relearn") {
    if (input.result === "FAMILIAR") {
      const required = current.relearnMode === "FORGOT" ? 5 : 3;
      nextCount += 1;
      if (nextCount >= required) {
        nextCount = 0;
        nextMode = "NONE";
        nextStatus = "review";
      } else {
        reinserted = true;
      }
    } else if (input.result === "BLURRY") {
      nextCount = 0;
      reinserted = true;
    } else {
      if (current.relearnMode === "BLURRY" && !input.confirmForget) {
        return {
          order: [...input.order],
          cards,
          card: current,
          reinserted: false,
          requiresConfirmation: true,
        };
      }
      nextCount = 0;
      nextMode = "FORGOT";
      reinserted = true;
    }
  } else if (current.status === "new" || current.status === "review") {
    if (input.result === "FAMILIAR") {
      nextMode = "NONE";
      nextStatus = current.status === "new" ? "review" : "review";
    } else {
      nextCount = 0;
      nextMode = input.result === "FORGOT" ? "FORGOT" : "BLURRY";
      nextStatus = "relearn";
      reinserted = true;
    }
  }

  if (reinserted) {
    insertRelearn(queue, input.cardId, nextCount, insertedAtOffset);
  }

  const updatedCard: Card = {
    ...current,
    status: nextStatus,
    relearnCorrectCount: nextCount,
    relearnMode: nextMode,
  };
  cards[cardIndex] = updatedCard;

  return {
    order: queue,
    cards,
    card: updatedCard,
    reinserted,
    requiresConfirmation,
  };
}
