package top.kariscode.karisanki.web.dto;

import java.util.List;

public final class BootstrapDtos {

	private BootstrapDtos() {
	}

	public record BootstrapResponse(AuthDtos.UserResponse user, List<DeckDtos.DeckResponse> decks) {
	}
}
