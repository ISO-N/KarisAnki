package top.kariscode.karisanki.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.deck.Deck;
import top.kariscode.karisanki.repository.CardRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.DeckRepository;
import top.kariscode.karisanki.web.dto.DeckDtos;
import top.kariscode.karisanki.web.error.BusinessException;

@Service
public class DeckService {

	private final DeckRepository deckRepository;
	private final CardRepository cardRepository;
	private final CardStateRepository cardStateRepository;
	private final DueStateService dueStateService;
	private final top.kariscode.karisanki.repository.UserRepository userRepository;
	private final StatisticsCacheService statisticsCacheService;

	public DeckService(DeckRepository deckRepository, CardRepository cardRepository,
			CardStateRepository cardStateRepository, DueStateService dueStateService,
			top.kariscode.karisanki.repository.UserRepository userRepository,
			StatisticsCacheService statisticsCacheService) {
		this.deckRepository = deckRepository;
		this.cardRepository = cardRepository;
		this.cardStateRepository = cardStateRepository;
		this.dueStateService = dueStateService;
		this.userRepository = userRepository;
		this.statisticsCacheService = statisticsCacheService;
	}

	@Transactional
	public List<DeckDtos.DeckResponse> list(Long userId, LocalDate today) {
		dueStateService.markDueStates(userId, today, Instant.now());
		Map<Long, DeckCount> counts = cardStateRepository.countActiveByUser(userId, today).stream()
				.collect(Collectors.toMap(CardStateRepository.DeckCountProjection::getDeckId,
						projection -> new DeckCount(projection.getNewCount(), projection.getRelearnCount(),
								projection.getDueCount())));
		return deckRepository.findActiveByUserIdOrderByCreatedAtDesc(userId).stream()
				.map(deck -> toResponse(deck, today, counts.getOrDefault(deck.getId(), DeckCount.empty())))
				.toList();
	}

	@Transactional
	public DeckDtos.DeckResponse create(Long userId, String name) {
		String cleanName = cleanName(name);
		Deck deck = new Deck(requireUser(userId), cleanName);
		deckRepository.save(deck);
		statisticsCacheService.invalidateUser(userId);
		return new DeckDtos.DeckResponse(deck.getId(), deck.getName(), 0, 0, 0, deck.getCreatedAt());
	}

	@Transactional
	public DeckDtos.DeckResponse rename(Long userId, Long deckId, String name, LocalDate today) {
		Deck deck = requireDeck(userId, deckId);
		deck.rename(cleanName(name));
		deckRepository.save(deck);
		statisticsCacheService.invalidateUser(userId);
		return toResponse(deck, today);
	}

	@Transactional
	public void delete(Long userId, Long deckId) {
		Deck deck = requireDeck(userId, deckId);
		cardRepository.findActiveByDeckForUser(deckId, userId).forEach(Card::delete);
		deck.delete();
		deckRepository.save(deck);
		statisticsCacheService.invalidateUser(userId);
	}

	@Transactional
	public void resetDeck(Long userId, Long deckId, LocalDate now) {
		requireDeck(userId, deckId);
		List<Card> cards = cardRepository.findActiveByDeckForUserOrderByCreatedAtAsc(deckId, userId);
		for (int index = 0; index < cards.size(); index++) {
			Card card = cards.get(index);
			card.setPosition(index + 1L);
			resetState(card.getState());
			cardRepository.save(card);
		}
		statisticsCacheService.invalidateDeck(userId, deckId);
	}

	@Transactional
	public void resetCard(Long userId, Long cardId) {
		Card card = cardRepository.findActiveByIdForUser(cardId, userId)
				.orElseThrow(() -> BusinessException.notFound("card_not_found", "卡片不存在"));
		long nextPosition = cardRepository.minPosition(card.getDeck().getId()) - 1;
		card.setPosition(nextPosition);
		resetState(card.getState());
		cardRepository.save(card);
		statisticsCacheService.invalidateDeck(userId, card.getDeck().getId());
	}

	@Transactional(readOnly = true)
	public DeckDtos.DeckResponse get(Long userId, Long deckId, LocalDate today) {
		Deck deck = requireDeck(userId, deckId);
		return toResponse(deck, today);
	}

	@Transactional(readOnly = true)
	public Deck requireDeck(Long userId, Long deckId) {
		return deckRepository.findActiveByIdForUser(deckId, userId)
				.orElseThrow(() -> BusinessException.notFound("deck_not_found", "卡组不存在"));
	}

	private void resetState(CardState state) {
		state.setStage(-1);
		state.setQueueType(top.kariscode.karisanki.domain.CardQueue.NEW);
		state.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.NONE);
		state.setRelearnOrigin(null);
		state.setRelearnCorrectCount(0);
		state.setDueDate(null);
		state.setDueSince(null);
		cardStateRepository.save(state);
	}

	private DeckDtos.DeckResponse toResponse(Deck deck, LocalDate today) {
		return toResponse(deck, today, null);
	}

	private DeckDtos.DeckResponse toResponse(Deck deck, LocalDate today, DeckCount count) {
		long newCount = count == null
				? cardStateRepository.countNewByDeckForUser(deck.getId(), deck.getUser().getId())
				: count.newCount();
		long relearnCount = count == null
				? cardStateRepository.countRelearnByDeckForUser(deck.getId(), deck.getUser().getId())
				: count.relearnCount();
		long dueCount = count == null
				? cardStateRepository.countDueByDeckForUser(deck.getId(), deck.getUser().getId(), today)
				: count.dueCount();
		return new DeckDtos.DeckResponse(deck.getId(), deck.getName(), newCount, relearnCount, dueCount,
				deck.getCreatedAt());
	}

	private String cleanName(String name) {
		String clean = name == null ? "" : name.trim();
		if (clean.isBlank()) {
			throw BusinessException.badRequest("name_required", "卡组名称不能为空");
		}
		if (clean.length() > 120) {
			throw BusinessException.badRequest("name_too_long", "卡组名称不能超过 120 个字符");
		}
		return clean;
	}

	private top.kariscode.karisanki.domain.user.User requireUser(Long userId) {
		return userRepository.findById(userId)
				.orElseThrow(() -> BusinessException.unauthorized("unauthenticated", "登录状态已失效"));
	}

	private record DeckCount(long newCount, long relearnCount, long dueCount) {
		private static DeckCount empty() {
			return new DeckCount(0, 0, 0);
		}
	}
}
