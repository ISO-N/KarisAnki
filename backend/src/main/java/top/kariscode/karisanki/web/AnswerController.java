package top.kariscode.karisanki.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.AnswerService;
import top.kariscode.karisanki.web.dto.AnswerBatchDtos;
import top.kariscode.karisanki.web.dto.AnswerRequest;
import top.kariscode.karisanki.web.dto.AnswerResponse;

@RestController
@RequestMapping("/api")
public class AnswerController {

	private final AnswerService answerService;

	public AnswerController(AnswerService answerService) {
		this.answerService = answerService;
	}

	@PostMapping("/answer")
	public AnswerResponse answer(@AuthenticationPrincipal UserPrincipal principal,
			@Valid @RequestBody AnswerRequest request) {
		return answerService.answer(principal.id(), request);
	}

	@PostMapping("/answer/batch")
	public AnswerBatchDtos.AnswerBatchResponse answerBatch(@AuthenticationPrincipal UserPrincipal principal,
			@Valid @RequestBody AnswerBatchDtos.AnswerBatchRequest request) {
		return answerService.answerBatch(principal.id(), request);
	}
}
