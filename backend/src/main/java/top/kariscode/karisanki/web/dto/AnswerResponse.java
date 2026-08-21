package top.kariscode.karisanki.web.dto;

public record AnswerResponse(Long cardId, String clientAnswerId, boolean accepted, Long nextCardId,
		boolean completed, boolean requiresConfirmation) {
}
