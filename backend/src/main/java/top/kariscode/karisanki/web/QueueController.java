package top.kariscode.karisanki.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.QueueService;
import top.kariscode.karisanki.web.dto.QueueResponse;

@RestController
@RequestMapping("/api/decks/{deckId}")
public class QueueController {

	private final QueueService queueService;

	public QueueController(QueueService queueService) {
		this.queueService = queueService;
	}

	@GetMapping("/queue")
	public QueueResponse queue(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long deckId,
			@RequestParam String type, @RequestParam(defaultValue = "UTC") String timezone) {
		StudyQueue queueType = StudyQueue.valueOf(type.toUpperCase());
		return queueService.queue(principal.id(), deckId, queueType, timezone);
	}
}
