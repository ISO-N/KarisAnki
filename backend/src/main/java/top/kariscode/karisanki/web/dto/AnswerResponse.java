package top.kariscode.karisanki.web.dto;

import java.util.List;

public record AnswerResponse(Long cardId, Long nextCardId, List<Long> queue, boolean completed,
		boolean requiresConfirmation) {
}
