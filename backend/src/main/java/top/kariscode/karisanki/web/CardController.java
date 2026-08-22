package top.kariscode.karisanki.web;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.CardService;
import top.kariscode.karisanki.service.DeckService;
import top.kariscode.karisanki.web.dto.CardDtos;

@RestController
@RequestMapping("/api")
public class CardController {

	private final CardService cardService;
	private final DeckService deckService;

	public CardController(CardService cardService, DeckService deckService) {
		this.cardService = cardService;
		this.deckService = deckService;
	}

	@GetMapping("/decks/{deckId}/cards")
	public CardDtos.CardListResponse list(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId,
			@RequestParam(required = false) String q,
			@RequestParam(required = false) String status,
			@RequestParam(defaultValue = "0") int page) {
		return cardService.list(principal.id(), deckId, q, status, page);
	}

	@PostMapping("/decks/{deckId}/cards")
	@ResponseStatus(HttpStatus.CREATED)
	public CardDtos.CardResponse create(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId, @Valid @RequestBody CardDtos.CreateCardRequest request) {
		return cardService.create(principal.id(), deckId, request.front(), request.back());
	}

	@GetMapping("/cards/{cardId}")
	public CardDtos.CardResponse get(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long cardId) {
		return cardService.get(principal.id(), cardId);
	}

	@PutMapping("/cards/{cardId}")
	public CardDtos.CardResponse update(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long cardId,
			@Valid @RequestBody CardDtos.UpdateCardRequest request) {
		return cardService.update(principal.id(), cardId, request.front(), request.back());
	}

	@DeleteMapping("/cards/{cardId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long cardId) {
		cardService.delete(principal.id(), cardId);
	}

	@PostMapping("/cards/{cardId}/reset")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void reset(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long cardId) {
		deckService.resetCard(principal.id(), cardId);
	}

	@PostMapping("/decks/{deckId}/cards/parse")
	public CardDtos.ImportPreviewResponse parse(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId, @RequestBody CardDtos.ParseCardRequest request) {
		return cardService.parseCards(principal.id(), deckId, request.source());
	}

	@PostMapping("/decks/{deckId}/cards/import")
	public CardDtos.ImportResult importCards(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId, @RequestBody CardDtos.ImportCardsRequest request) {
		return cardService.importCards(principal.id(), deckId, request);
	}

	@PostMapping("/decks/{deckId}/cards/pronunciation/backfill")
	public CardDtos.PronunciationBackfillResponse backfillPronunciation(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId) {
		return cardService.backfillPronunciation(principal.id(), deckId);
	}
}
