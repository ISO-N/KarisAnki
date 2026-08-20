package top.kariscode.karisanki.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.StatisticsService;
import top.kariscode.karisanki.web.dto.StatisticsResponse;

@RestController
@RequestMapping("/api/statistics")
public class StatisticsController {

	private final StatisticsService statisticsService;

	public StatisticsController(StatisticsService statisticsService) {
		this.statisticsService = statisticsService;
	}

	@GetMapping
	public StatisticsResponse summary(@AuthenticationPrincipal UserPrincipal principal,
			@RequestParam(required = false) Long deckId,
			@RequestParam(defaultValue = "UTC") String timezone) {
		return statisticsService.summary(principal.id(), deckId, timezone);
	}
}
