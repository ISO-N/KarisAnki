package top.kariscode.karisanki.web;

import java.time.Instant;
import java.time.LocalDate;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.AuthService;
import top.kariscode.karisanki.service.DeckService;
import top.kariscode.karisanki.service.TimeService;
import top.kariscode.karisanki.web.dto.BootstrapDtos;

@RestController
@RequestMapping("/api")
public class BootstrapController {

	private final AuthService authService;
	private final DeckService deckService;
	private final TimeService timeService;

	public BootstrapController(AuthService authService, DeckService deckService, TimeService timeService) {
		this.authService = authService;
		this.deckService = deckService;
		this.timeService = timeService;
	}

	@GetMapping("/bootstrap")
	public BootstrapDtos.BootstrapResponse bootstrap(@AuthenticationPrincipal UserPrincipal principal,
			@RequestParam(defaultValue = "UTC") String timezone) {
		var settings = authService.settings(principal.id());
		LocalDate learningDay = timeService.learningDay(settings.getRefreshTime(), timezone, Instant.now());
		return new BootstrapDtos.BootstrapResponse(authService.currentUser(principal.id()),
				deckService.list(principal.id(), learningDay));
	}
}
