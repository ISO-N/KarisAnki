package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.deck.Deck;
import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.repository.CardStateRepository;

class DueStateServiceTest {

	@Test
	void markDueStatesSetsDueSinceAndSavesEachState() {
		CardStateRepository repository = mock(CardStateRepository.class);
		User user = new User("user@example.com", "hash");
		Deck deck = new Deck(user, "Deck");
		Card card = new Card(deck, "Front", "Back", 1);
		CardState state = new CardState(card);
		card.setState(state);
		state.setStage(0);
		state.setQueueType(CardQueue.REVIEW);
		state.setRelearnMode(RelearnMode.NONE);
		state.setDueDate(LocalDate.of(2026, 8, 20));

		Instant now = Instant.parse("2026-08-20T03:00:00Z");
		when(repository.findActiveDueReviewsWithoutDueSinceForUser(1L, LocalDate.of(2026, 8, 20)))
				.thenReturn(List.of(state));

		new DueStateService(repository).markDueStates(1L, LocalDate.of(2026, 8, 20), now);

		assertEquals(now, state.getDueSince());
		verify(repository).save(state);
	}

	@Test
	void refreshTimeAndTimezoneControlWhichDateIsMarkedDue() {
		CardStateRepository repository = mock(CardStateRepository.class);
		TimeService timeService = new TimeService();
		Instant now = Instant.parse("2026-08-20T05:00:00Z");

		LocalDate lateRefreshDay = timeService.learningDay(LocalTime.of(23, 0), "UTC", now);
		LocalDate earlyRefreshDay = timeService.learningDay(LocalTime.of(4, 0), "UTC", now);

		when(repository.findActiveDueReviewsWithoutDueSinceForUser(eq(1L), any()))
				.thenReturn(List.of());
		new DueStateService(repository).markDueStates(1L, lateRefreshDay, now);
		verify(repository).findActiveDueReviewsWithoutDueSinceForUser(1L, lateRefreshDay);

		new DueStateService(repository).markDueStates(1L, earlyRefreshDay, now);
		verify(repository).findActiveDueReviewsWithoutDueSinceForUser(1L, earlyRefreshDay);
	}

	@Test
	void noDueStatesDoesNotSave() {
		CardStateRepository repository = mock(CardStateRepository.class);
		when(repository.findActiveDueReviewsWithoutDueSinceForUser(any(), any())).thenReturn(List.of());

		new DueStateService(repository).markDueStates(1L, LocalDate.of(2026, 8, 20),
				Instant.parse("2026-08-20T03:00:00Z"));

		verify(repository, never()).save(any());
	}
}
