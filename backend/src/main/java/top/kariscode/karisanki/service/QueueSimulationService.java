package top.kariscode.karisanki.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.scheduling.ScheduleState;

@Service
public class QueueSimulationService {

	public MutableQueue create(QueueService.QueueSnapshot snapshot) {
		Map<Long, Card> cardsById = new LinkedHashMap<>();
		snapshot.cards().forEach(card -> cardsById.put(card.getId(), card));

		List<Long> normalOrder = new ArrayList<>();
		List<Long> relearnOrder = new ArrayList<>();
		Map<Long, Integer> relearnCorrectCounts = new HashMap<>();
		for (Long cardId : snapshot.order()) {
			CardState state = cardsById.get(cardId) == null ? null : cardsById.get(cardId).getState();
			if (state != null && state.getQueueType() == CardQueue.RELEARN) {
				relearnOrder.add(cardId);
				relearnCorrectCounts.put(cardId, state.getRelearnCorrectCount());
			} else {
				normalOrder.add(cardId);
			}
		}
		return new MutableQueue(normalOrder, relearnOrder, cardsById, relearnCorrectCounts);
	}

	public AdvanceResult advance(MutableQueue queue, Card card, ScheduleState previous, ScheduleState next) {
		Long cardId = card.getId();
		queue.normalOrder.remove(cardId);
		queue.relearnOrder.remove(cardId);
		queue.relearnCorrectCounts.remove(cardId);

		if (next.queueType() == CardQueue.RELEARN) {
			queue.relearnOrder.add(cardId);
			queue.relearnCorrectCounts.put(cardId, next.relearnCorrectCount());
		}

		List<Long> order = new ArrayList<>(queue.normalOrder);
		Map<Integer, Integer> insertedAtOffset = new HashMap<>();
		for (Long relearnCardId : queue.relearnOrder) {
			int correctCount = queue.relearnCorrectCounts.getOrDefault(relearnCardId, 0);
			int base = insertionBase(order.size(), correctCount);
			int sameOffset = insertedAtOffset.getOrDefault(base, 0);
			int index = Math.min(base + sameOffset, order.size());
			order.add(index, relearnCardId);
			insertedAtOffset.merge(base, 1, Integer::sum);
		}

		return new AdvanceResult(List.copyOf(order), order.isEmpty() ? null : order.get(0));
	}

	private int insertionBase(int queueSize, int correctCount) {
		return Math.min(1 << Math.max(0, correctCount), queueSize);
	}

	public static final class MutableQueue {
		private final List<Long> normalOrder;
		private final List<Long> relearnOrder;
		private final Map<Long, Card> cardsById;
		private final Map<Long, Integer> relearnCorrectCounts;

		private MutableQueue(List<Long> normalOrder, List<Long> relearnOrder, Map<Long, Card> cardsById,
				Map<Long, Integer> relearnCorrectCounts) {
			this.normalOrder = normalOrder;
			this.relearnOrder = relearnOrder;
			this.cardsById = cardsById;
			this.relearnCorrectCounts = relearnCorrectCounts;
		}

		public Card card(Long cardId) {
			return cardsById.get(cardId);
		}
	}

	public record AdvanceResult(List<Long> order, Long nextCardId) {
	}
}
