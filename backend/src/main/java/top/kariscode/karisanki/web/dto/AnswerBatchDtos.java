package top.kariscode.karisanki.web.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.StudyQueue;

public final class AnswerBatchDtos {

	private AnswerBatchDtos() {
	}

	public record AnswerBatchRequest(
			@NotNull Long deckId,
			@NotNull StudyQueue queueType,
			@NotBlank String timezone,
			@NotEmpty @Valid List<AnswerItemRequest> items) {
	}

	public record AnswerItemRequest(
			@NotBlank String clientAnswerId,
			@NotNull Long cardId,
			@NotNull AnswerResult result,
			@NotNull Long stateVersion,
			String previousClientAnswerId,
			Boolean graduate,
			Boolean confirmForget) {
	}

	public record AnswerBatchResponse(List<AnswerItemResponse> results) {
	}

	public record AnswerItemResponse(
			Long cardId,
			String clientAnswerId,
			boolean accepted,
			String code,
			Long nextCardId,
			boolean completed,
			boolean requiresConfirmation) {
	}
}
