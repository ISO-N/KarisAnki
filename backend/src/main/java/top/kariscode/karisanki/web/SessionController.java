package top.kariscode.karisanki.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.SessionService;
import top.kariscode.karisanki.web.dto.SessionDtos;
import top.kariscode.karisanki.web.error.BusinessException;

@RestController
@RequestMapping("/api/decks/{deckId}")
public class SessionController {

	private final SessionService sessionService;

	public SessionController(SessionService sessionService) {
		this.sessionService = sessionService;
	}

	@GetMapping("/session")
	public SessionDtos.SessionResponse session(@AuthenticationPrincipal UserPrincipal principal,
			@PathVariable Long deckId, @RequestParam String type,
			@RequestParam(defaultValue = "UTC") String timezone) {
		StudyQueue queueType;
		try {
			queueType = StudyQueue.valueOf(type.toUpperCase());
		}
		catch (IllegalArgumentException exception) {
			throw BusinessException.badRequest("invalid_queue_type", "队列类型无效");
		}
		return sessionService.session(principal.id(), deckId, queueType, timezone);
	}
}
