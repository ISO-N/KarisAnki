package top.kariscode.karisanki.web.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;

import top.kariscode.karisanki.domain.RelearnMode;

public final class CardDtos {

	private CardDtos() {
	}

	public record CardResponse(Long id, Long deckId, String front, String back, long position, String status,
			int stage, RelearnMode relearnMode, int relearnCorrectCount, LocalDate dueDate, Long stateVersion,
			Instant createdAt) {
	}

	public record CreateCardRequest(@NotBlank String front, String back) {
	}

	public record UpdateCardRequest(@NotBlank String front, String back) {
	}

	public record CardListResponse(List<CardResponse> items, long total, int page, int pageSize) {
	}
}
