package top.kariscode.karisanki.web.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class DeckDtos {

	private DeckDtos() {
	}

	public record DeckResponse(Long id, String name, long newCount, long relearnCount, long dueCount,
			Instant createdAt) {
	}
	public record DeckOverviewResponse(DeckResponse deck, CardDtos.CardListResponse cards) {
	}

	public record CreateDeckRequest(@NotBlank @Size(max = 120) String name) {
	}

	public record RenameDeckRequest(@NotBlank @Size(max = 120) String name) {
	}
}
