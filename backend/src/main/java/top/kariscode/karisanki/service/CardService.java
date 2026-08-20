package top.kariscode.karisanki.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.deck.Deck;
import top.kariscode.karisanki.repository.CardRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.web.dto.CardDtos;
import top.kariscode.karisanki.web.error.BusinessException;

@Service
public class CardService {

	private final DeckService deckService;
	private final CardRepository cardRepository;
	private final CardStateRepository cardStateRepository;

	public CardService(DeckService deckService, CardRepository cardRepository,
			CardStateRepository cardStateRepository) {
		this.deckService = deckService;
		this.cardRepository = cardRepository;
		this.cardStateRepository = cardStateRepository;
	}

	@Transactional
	public CardDtos.CardResponse create(Long userId, Long deckId, String front, String back) {
		Deck deck = deckService.requireDeck(userId, deckId);
		String cleanFront = requireFront(front);
		long position = cardRepository.maxPosition(deckId) + 1;
		Card card = new Card(deck, cleanFront, cleanBack(back), position);
		CardState state = new CardState(card);
		card.setState(state);
		cardRepository.save(card);
		cardStateRepository.save(state);
		return toResponse(card);
	}

	@Transactional
	public CardDtos.CardResponse update(Long userId, Long cardId, String front, String back) {
		Card card = requireCard(userId, cardId);
		card.updateContent(requireFront(front), cleanBack(back));
		cardRepository.save(card);
		return toResponse(card);
	}

	@Transactional
	public void delete(Long userId, Long cardId) {
		Card card = requireCard(userId, cardId);
		card.delete();
		cardRepository.save(card);
	}

	@Transactional(readOnly = true)
	public CardDtos.CardListResponse list(Long userId, Long deckId, String query, String status, int page) {
		deckService.requireDeck(userId, deckId);
		int safePage = Math.max(0, page);
		String cleanQuery = query == null || query.isBlank() ? null : query.trim();
		String cleanStatus = status == null || status.isBlank() ? null : status;
		Page<Card> cards = cardRepository.searchInDeck(deckId, userId, cleanQuery, cleanStatus,
				PageRequest.of(safePage, 50));
		return new CardDtos.CardListResponse(cards.getContent().stream().map(this::toResponse).toList(),
				cards.getTotalElements(), cards.getNumber(), cards.getSize());
	}

	@Transactional(readOnly = true)
	public CardDtos.CardResponse get(Long userId, Long cardId) {
		return toResponse(requireCard(userId, cardId));
	}

	public Card requireCard(Long userId, Long cardId) {
		return cardRepository.findActiveByIdForUser(cardId, userId)
				.orElseThrow(() -> BusinessException.notFound("card_not_found", "卡片不存在"));
	}

	private CardDtos.CardResponse toResponse(Card card) {
		CardState state = card.getState();
		return new CardDtos.CardResponse(card.getId(), card.getDeck().getId(), card.getFront(), card.getBack(),
				card.getPosition(), status(state), state.getStage(), state.getRelearnMode(),
				state.getRelearnCorrectCount(), state.getDueDate(), state.getVersion(), card.getCreatedAt());
	}

	private String status(CardState state) {
		if (state.getStage() == 9) {
			return "graduated";
		}
		return switch (state.getQueueType()) {
			case NEW -> "new";
			case REVIEW -> "review";
			case RELEARN -> "relearn";
			case DONE -> "graduated";
		};
	}

	private String requireFront(String front) {
		if (front == null || front.isBlank()) {
			throw BusinessException.badRequest("front_required", "卡片正面不能为空");
		}
		return front.trim();
	}

	private String cleanBack(String back) {
		return back == null ? null : back.trim();
	}
}
