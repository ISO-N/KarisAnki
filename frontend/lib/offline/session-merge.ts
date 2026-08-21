export interface AcceptedAnswerMergeInput {
  order: number[];
  cardId: number;
  nextCardId: number | null;
  completed: boolean;
  reinserted: boolean;
}

export function mergeAcceptedAnswerOrder(input: AcceptedAnswerMergeInput): number[] {
  if (input.completed) {
    return [];
  }
  if (input.reinserted) {
    return [...input.order];
  }

  let order = input.order.filter((id) => id !== input.cardId);
  if (input.nextCardId !== null && input.nextCardId !== order[0] && order.includes(input.nextCardId)) {
    order = [input.nextCardId, ...order.filter((id) => id !== input.nextCardId)];
  }
  return order;
}
