import { describe, expect, it } from "vitest";
import { mergeAcceptedAnswerOrder } from "./session-merge";

describe("mergeAcceptedAnswerOrder", () => {
  it("preserves a reinserted relearn card at its local 2^n position", () => {
    const order = mergeAcceptedAnswerOrder({
      order: [2, 1, 3],
      cardId: 1,
      nextCardId: 2,
      completed: false,
      reinserted: true,
    });

    expect(order).toEqual([2, 1, 3]);
  });

  it("removes a normal answered card and uses the server next card", () => {
    const order = mergeAcceptedAnswerOrder({
      order: [2, 3],
      cardId: 1,
      nextCardId: 2,
      completed: false,
      reinserted: false,
    });

    expect(order).toEqual([2, 3]);
  });

  it("moves a server next card to the front when it is not already first", () => {
    const order = mergeAcceptedAnswerOrder({
      order: [3, 2],
      cardId: 1,
      nextCardId: 2,
      completed: false,
      reinserted: false,
    });

    expect(order).toEqual([2, 3]);
  });

  it("clears the queue when the server reports completion", () => {
    const order = mergeAcceptedAnswerOrder({
      order: [1],
      cardId: 1,
      nextCardId: null,
      completed: true,
      reinserted: false,
    });

    expect(order).toEqual([]);
  });
});
