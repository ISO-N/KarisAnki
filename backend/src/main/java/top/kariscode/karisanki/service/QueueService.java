package top.kariscode.karisanki.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnOrigin;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.web.dto.QueueResponse;

@Service
public class QueueService {

	private final DeckService deckService;
	private final AuthService authService;
	private final CardStateRepository cardStateRepository;
	private final DueStateService dueStateService;
	private final TimeService timeService;

	public QueueService(DeckService deckService, AuthService authService,
			CardStateRepository cardStateRepository, DueStateService dueStateService, TimeService timeService) {
		this.deckService = deckService;
		this.authService = authService;
		this.cardStateRepository = cardStateRepository;
		this.dueStateService = dueStateService;
		this.timeService = timeService;
	}

	@Transactional
	public QueueResponse queue(Long userId, Long deckId, StudyQueue type, String timezone) {
		QueueSnapshot snapshot = sessionQueue(userId, deckId, type, timezone);
		return new QueueResponse(deckId, type.name(), snapshot.order());
	}

	@Transactional
	public QueueSnapshot sessionQueue(Long userId, Long deckId, StudyQueue type, String timezone) {
		deckService.requireDeck(userId, deckId);
		Instant now = Instant.now();
		LocalDate learningDay = timeService.learningDay(authService.settings(userId).getRefreshTime(), timezone, now);
		dueStateService.markDueStates(userId, learningDay, now);
		RelearnOrigin origin = type == StudyQueue.LEARN ? RelearnOrigin.LEARN : RelearnOrigin.REVIEW;

		List<CardState> normalStates = switch (type) {
			case LEARN -> cardStateRepository.findActiveNewByDeckForUser(deckId, userId);
			case REVIEW -> {
				List<CardState> dueStates = cardStateRepository.findActiveReviewByDeckForUser(deckId, userId, learningDay);
				yield dueStates.stream()
						.sorted(Comparator
								.comparing((CardState cs) -> cs.getDueDate() == null ? LocalDate.MAX : cs.getDueDate())
								.thenComparing(cs -> cs.getCard().getCreatedAt())
								.thenComparing(cs -> cs.getCard().getId()))
						.toList();
			}
		};

		List<Long> queue = new ArrayList<>();
		Map<Long, CardState> statesByCardId = new HashMap<>();
		for (CardState state : normalStates) {
			queue.add(state.getCard().getId());
			statesByCardId.put(state.getCard().getId(), state);
		}

		List<CardState> relearn = cardStateRepository.findActiveRelearnByDeckAndOriginForUser(deckId, userId, origin);
		Map<Integer, Integer> insertedAtOffset = new HashMap<>();
		for (CardState state : relearn) {
			insertRelearn(queue, state.getCard().getId(), state.getRelearnCorrectCount(), insertedAtOffset);
			statesByCardId.put(state.getCard().getId(), state);
		}

		List<Card> cards = queue.stream()
				.map(statesByCardId::get)
				.map(CardState::getCard)
				.toList();
		return new QueueSnapshot(List.copyOf(queue), List.copyOf(cards));
	}

	private void insertRelearn(List<Long> queue, Long cardId, int correctCount, Map<Integer, Integer> insertedAtOffset) {
		int base = Math.min(1 << Math.max(0, correctCount), queue.size());
		int sameOffset = insertedAtOffset.getOrDefault(base, 0);
		int index = Math.min(base + sameOffset, queue.size());
		queue.add(index, cardId);
		insertedAtOffset.put(base, sameOffset + 1);
	}

	public record QueueSnapshot(List<Long> order, List<Card> cards) {
	}
}
