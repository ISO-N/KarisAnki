package top.kariscode.karisanki.web.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.StudyQueue;
public record AnswerRequest(
		@NotNull Long cardId,
		@NotNull AnswerResult result,
		@NotNull StudyQueue queueType,
		@NotBlank String timezone,
		Long stateVersion,
		Boolean graduate,
		Boolean confirmForget) {
}
