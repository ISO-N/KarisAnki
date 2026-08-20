package top.kariscode.karisanki.web.dto;

import java.util.List;

public record QueueResponse(Long deckId, String type, List<Long> cardIds) {
}
