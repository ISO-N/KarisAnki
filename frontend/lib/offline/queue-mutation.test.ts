import { describe, expect, it } from "vitest";
import vectors from "../../../contracts/scheduling-vectors.json";
import { mutateLocalQueue } from "./queue-mutation";
import type { AnswerResult, Card } from "@/lib/types";
import type { StudyQueueType } from "./types";

function card(
  id: number,
  status: Card["status"] = "new",
  relearnCorrectCount = 0,
  relearnMode: Card["relearnMode"] = "NONE",
): Card {
  return {
    id,
    deckId: 1,
    front: `Front ${id}`,
    back: `Back ${id}`,
    phonetic: null,
    position: id,
    status,
    stage: status === "relearn" ? 0 : -1,
    relearnMode,
    relearnCorrectCount,
    dueDate: null,
    stateVersion: 1,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("mutateLocalQueue", () => {
  it("removes a normal familiar card from the queue", () => {
    const cards = [card(1), card(2), card(3)];
    const result = mutateLocalQueue({
      order: [1, 2, 3],
      cards,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
    });
    expect(result.order).toEqual([2, 3]);
    expect(result.reinserted).toBe(false);
  });

  it("reinserts a blurred new card using the 2^n rule", () => {
    const cards = [card(1), card(2), card(3)];
    const result = mutateLocalQueue({
      order: [1, 2, 3],
      cards,
      cardId: 1,
      result: "BLURRY",
      queueType: "LEARN",
    });
    expect(result.order).toEqual([2, 1, 3]);
    expect(result.reinserted).toBe(true);
    expect(result.card?.status).toBe("relearn");
  });

  it("reinserts a relearn familiar card at the next exponential offset", () => {
    const cards = [card(1), card(2), card(3), card(4), card(5), card(6), card(7), card(8)];
    const relearn = card(9, "relearn", 1, "BLURRY");
    cards.push(relearn);
    const result = mutateLocalQueue({
      order: [1, 2, 9, 3, 4, 5, 6, 7, 8],
      cards,
      cardId: 9,
      result: "FAMILIAR",
      queueType: "LEARN",
    });
    expect(result.order).toEqual([1, 2, 3, 4, 9, 5, 6, 7, 8]);
    expect(result.reinserted).toBe(true);
    expect(result.card?.relearnCorrectCount).toBe(2);
  });

  it("removes a relearn card when its familiar count reaches the required total", () => {
    const cards = [card(1, "relearn", 2, "BLURRY")];
    const result = mutateLocalQueue({
      order: [1],
      cards,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "REVIEW",
    });
    expect(result.order).toEqual([]);
    expect(result.reinserted).toBe(false);
    expect(result.card?.status).toBe("review");
  });

  it.each(vectors.queue)("matches shared queue vector $name", ({ order, cards, cardId, result, expectedOrder, queueType }) => {
    const fullCards = cards.map((item) =>
      card(
        item.id,
        item.status as Card["status"],
        item.relearnCorrectCount,
        item.relearnMode as Card["relearnMode"],
      ),
    );

    const outcome = mutateLocalQueue({
      order: [...order],
      cards: fullCards,
      cardId,
      result: result as AnswerResult,
      queueType: queueType as StudyQueueType,
    });

    expect(outcome.order).toEqual(expectedOrder);
  });

  it("requires confirmation before switching blurry relearn to forgot", () => {
    const cards = [card(1, "relearn", 0, "BLURRY")];
    const result = mutateLocalQueue({
      order: [1],
      cards,
      cardId: 1,
      result: "FORGOT",
      queueType: "LEARN",
      confirmForget: false,
    });
    expect(result.requiresConfirmation).toBe(true);
    expect(result.order).toEqual([1]);
  });
});
