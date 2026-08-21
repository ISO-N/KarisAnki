package top.kariscode.karisanki.service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import top.kariscode.karisanki.config.AppProperties;
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
	private final AppProperties appProperties;
	private final ObjectMapper objectMapper;

	public CardService(DeckService deckService, CardRepository cardRepository,
			CardStateRepository cardStateRepository, AppProperties appProperties, ObjectMapper objectMapper) {
		this.deckService = deckService;
		this.cardRepository = cardRepository;
		this.cardStateRepository = cardStateRepository;
		this.appProperties = appProperties;
		this.objectMapper = objectMapper;
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

	@Transactional(readOnly = true)
	public CardDtos.ImportPreviewResponse parseCards(Long userId, Long deckId, String source) {
		deckService.requireDeck(userId, deckId);
		requireParseSource(source);

		JsonNode root;
		try {
			root = objectMapper.readTree(source);
		} catch (Exception exception) {
			throw BusinessException.badRequest("invalid_import_json", "导入内容不是有效的 JSON");
		}

		if (root == null || !root.isArray()) {
			throw BusinessException.badRequest("invalid_import_json", "导入内容必须是 JSON 对象数组");
		}

		if (root.size() > appProperties.getImport().getMaxCards()) {
			throw BusinessException.badRequest("too_many_import_cards",
					"单次导入卡片数量不能超过 " + appProperties.getImport().getMaxCards() + " 张");
		}

		Set<String> existingKeys = loadCardKeys(deckId, userId);
		List<CardDtos.ImportPreviewItem> items = new ArrayList<>(root.size());
		for (int index = 0; index < root.size(); index++) {
			items.add(toPreviewItem(root.get(index), index + 1, existingKeys));
		}

		int validCount = (int) items.stream().filter(item -> item.errors().isEmpty()).count();
		int duplicateCount = (int) items.stream().filter(CardDtos.ImportPreviewItem::duplicate).count();
		int invalidCount = items.size() - validCount;
		return new CardDtos.ImportPreviewResponse(items, items.size(), validCount, duplicateCount, invalidCount);
	}

	@Transactional
	public CardDtos.ImportResult importCards(Long userId, Long deckId, CardDtos.ImportCardsRequest request) {
		Deck deck = deckService.requireDeck(userId, deckId);
		List<CardDtos.ImportCardRequest> rows = request == null ? null : request.rows();
		if (rows == null) {
			throw BusinessException.badRequest("invalid_import_json", "导入内容不能为空");
		}

		if (rows.size() > appProperties.getImport().getMaxCards()) {
			throw BusinessException.badRequest("too_many_import_cards",
					"单次导入卡片数量不能超过 " + appProperties.getImport().getMaxCards() + " 张");
		}

		List<NormalizedImportRow> normalizedRows = new ArrayList<>(rows.size());
		for (int index = 0; index < rows.size(); index++) {
			CardDtos.ImportCardRequest row = rows.get(index);
			if (row == null) {
				throw BusinessException.badRequest("invalid_import_json", "第 " + (index + 1) + " 行内容无效");
			}
			String front = row.front() == null ? "" : row.front().trim();
			String back = row.back() == null ? "" : row.back().trim();
			if (front.isBlank()) {
				throw BusinessException.badRequest("front_required", "第 " + (index + 1) + " 行卡片正面不能为空");
			}
			normalizedRows.add(new NormalizedImportRow(front, back));
		}

		Set<String> existingKeys = loadCardKeys(deckId, userId);
		long position = cardRepository.maxPosition(deckId) + 1;
		int created = 0;
		int skippedDuplicates = 0;

		for (NormalizedImportRow normalized : normalizedRows) {
			if (existingKeys.contains(cardKey(normalized.front(), normalized.back()))) {
				skippedDuplicates++;
				continue;
			}

			Card card = new Card(deck, normalized.front(), normalized.back(), position++);
			CardState state = new CardState(card);
			card.setState(state);
			cardRepository.save(card);
			cardStateRepository.save(state);
			created++;
		}

		return new CardDtos.ImportResult(created, skippedDuplicates);
	}

	public Card requireCard(Long userId, Long cardId) {
		return cardRepository.findActiveByIdForUser(cardId, userId)
				.orElseThrow(() -> BusinessException.notFound("card_not_found", "卡片不存在"));
	}

	private CardDtos.ImportPreviewItem toPreviewItem(JsonNode node, int row, Set<String> existingKeys) {
		if (node == null || !node.isObject()) {
			return new CardDtos.ImportPreviewItem(row, "", "", false, List.of("invalid_import_json"));
		}

		List<String> errors = new ArrayList<>();
		String front = "";
		boolean hasFront = node.has("front") && node.get("front").isTextual();
		if (hasFront) {
			front = node.get("front").asText().trim();
		}
		if (!hasFront || front.isBlank()) {
			errors.add("front_required");
		}

		String back = "";
		boolean hasBack = node.has("back");
		if (hasBack && node.get("back").isTextual()) {
			back = node.get("back").asText().trim();
		} else if (hasBack) {
			errors.add("back_invalid");
		}

		boolean duplicate = errors.isEmpty() && existingKeys.contains(cardKey(front, back));
		return new CardDtos.ImportPreviewItem(row, front, back, duplicate, List.copyOf(errors));
	}

	private void requireParseSource(String source) {
		if (source == null || source.isBlank()) {
			throw BusinessException.badRequest("invalid_import_json", "导入内容不能为空");
		}
		int sourceBytes = source.getBytes(StandardCharsets.UTF_8).length;
		if (sourceBytes > appProperties.getImport().getMaxSourceBytes()) {
			throw BusinessException.badRequest("import_source_too_large", "导入内容超过大小限制");
		}
	}

	private Set<String> loadCardKeys(Long deckId, Long userId) {
		Set<String> keys = new HashSet<>();
		cardRepository.findActiveContentByDeckForUser(deckId, userId)
				.forEach(item -> keys.add(cardKey(item.getFront(), item.getBack())));
		return keys;
	}

	private String cardKey(String front, String back) {
		return (front == null ? "" : front.trim()) + "\u0000" + (back == null ? "" : back.trim());
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

	private record NormalizedImportRow(String front, String back) {
	}
}
