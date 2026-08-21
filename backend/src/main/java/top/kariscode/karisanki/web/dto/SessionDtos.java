package top.kariscode.karisanki.web.dto;

import java.util.List;

public final class SessionDtos {

	private SessionDtos() {
	}

	public record SessionResponse(Long deckId, String type, String timezone, List<Long> order,
			List<CardDtos.CardResponse> cards, int total) {
	}
}
