package top.kariscode.karisanki.web;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.AuthService;
import top.kariscode.karisanki.service.CardService;
import top.kariscode.karisanki.service.DeckService;
import top.kariscode.karisanki.service.TimeService;
import top.kariscode.karisanki.web.dto.CardDtos;
import top.kariscode.karisanki.web.dto.DeckDtos;

@RestController
@RequestMapping("/api/decks")
public class DeckController {

	private final DeckService deckService;
	private final CardService cardService;
	private final AuthService authService;
	private final TimeService timeService;

	public DeckController(DeckService deckService, CardService cardService, AuthService authService,
			TimeService timeService) {
		this.deckService = deckService;
		this.cardService = cardService;
		this.authService = authService;
		this.timeService = timeService;
	}

	@GetMapping
	public List<DeckDtos.DeckResponse> list(@AuthenticationPrincipal UserPrincipal principal,
			@RequestParam(defaultValue = "UTC") String timezone) {
		return deckService.list(principal.id(), learningDay(principal.id(), timezone));
	}

	@GetMapping("/{deckId}")
	public DeckDtos.DeckOverviewResponse overview(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId,
			@RequestParam(defaultValue = "UTC") String timezone,
			@RequestParam(required = false) String q,
			@RequestParam(required = false) String status,
			@RequestParam(defaultValue = "0") int page) {
		DeckDtos.DeckResponse deck = deckService.get(principal.id(), deckId, learningDay(principal.id(), timezone));
		CardDtos.CardListResponse cards = cardService.list(principal.id(), deckId, q, status, page);
		return new DeckDtos.DeckOverviewResponse(deck, cards);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public DeckDtos.DeckResponse create(@AuthenticationPrincipal UserPrincipal principal,
			@Valid @RequestBody DeckDtos.CreateDeckRequest request) {
		return deckService.create(principal.id(), request.name());
	}

	@PatchMapping("/{deckId}")
	public DeckDtos.DeckResponse rename(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId, @Valid @RequestBody DeckDtos.RenameDeckRequest request,
			@RequestParam(defaultValue = "UTC") String timezone) {
		return deckService.rename(principal.id(), deckId, request.name(), learningDay(principal.id(), timezone));
	}

	@DeleteMapping("/{deckId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long deckId) {
		deckService.delete(principal.id(), deckId);
	}

	@PostMapping("/{deckId}/reset")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void reset(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long deckId,
			@RequestParam(defaultValue = "UTC") String timezone) {
		deckService.resetDeck(principal.id(), deckId, learningDay(principal.id(), timezone));
	}

	private LocalDate learningDay(Long userId, String timezone) {
		var settings = authService.settings(userId);
		return timeService.learningDay(settings.getRefreshTime(), timezone, Instant.now());
	}
}
