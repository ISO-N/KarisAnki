package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.RelearnOrigin;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.StudyScene;
import top.kariscode.karisanki.domain.deck.AnswerEvent;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.deck.Deck;
import top.kariscode.karisanki.domain.scheduling.ScheduleEngine;
import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSettings;
import top.kariscode.karisanki.repository.AnswerEventRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.DeckRepository;
import top.kariscode.karisanki.web.dto.StatisticsResponse;

class StatisticsServiceTest {

	@Test
	void summaryTracksCountsRetentionForecastAndHistoryOptions() {
		User user = new User("user@example.com", "hash");
		UserSettings settings = new UserSettings(user);
		settings.setRefreshTime(LocalTime.of(4, 0));

		AuthService authService = mock(AuthService.class);
		when(authService.settings(anyLong())).thenReturn(settings);

		Deck activeDeck = new Deck(user, "Current");
		ReflectionTestUtils.setField(activeDeck, "id", 1L);
		Deck deletedDeck = new Deck(user, "Old");
		ReflectionTestUtils.setField(deletedDeck, "id", 2L);
		deletedDeck.delete();

		Card learningCard = card(activeDeck, 1L);
		Card reviewCard = card(activeDeck, 2L);
		Card relearnCard = card(activeDeck, 3L);
		Card forecastCard = card(activeDeck, 4L);

		LocalDate today = LocalDate.now(ZoneOffset.UTC);
		List<AnswerEvent> events = List.of(
				event(activeDeck, learningCard, today.atTime(10, 15).toInstant(ZoneOffset.UTC), StudyScene.LEARN,
						StudyQueue.LEARN, -1, 0, AnswerResult.FAMILIAR),
				event(activeDeck, reviewCard, today.atTime(10, 30).toInstant(ZoneOffset.UTC), StudyScene.REVIEW,
						StudyQueue.REVIEW, 0, 1, AnswerResult.FAMILIAR),
				event(activeDeck, reviewCard, today.atTime(22, 0).toInstant(ZoneOffset.UTC), StudyScene.REVIEW,
						StudyQueue.REVIEW, 1, 0, AnswerResult.BLURRY),
				event(activeDeck, relearnCard, today.atTime(11, 0).toInstant(ZoneOffset.UTC), StudyScene.RELEARN,
						StudyQueue.REVIEW, 6, 5, AnswerResult.BLURRY));

		CardState reviewTomorrow = state(forecastCard, 0, CardQueue.REVIEW, RelearnMode.NONE, null, today.plusDays(1), null);
		CardState relearnToday = state(relearnCard, 6, CardQueue.RELEARN, RelearnMode.BLURRY, RelearnOrigin.REVIEW, today, null);
		CardState newCard = state(learningCard, -1, CardQueue.NEW, RelearnMode.NONE, null, null, null);
		CardState done = state(reviewCard, 9, CardQueue.DONE, RelearnMode.NONE, null, null, null);

		AnswerEventRepository answerEventRepository = mock(AnswerEventRepository.class);
		when(answerEventRepository.findByUserIdOrderByAnsweredAtAsc(anyLong())).thenReturn(events);
		CardStateRepository cardStateRepository = mock(CardStateRepository.class);
		when(cardStateRepository.findActiveForUser(anyLong())).thenReturn(List.of(reviewTomorrow, relearnToday, newCard, done));
		DeckRepository deckRepository = mock(DeckRepository.class);
		when(deckRepository.findHistoryDecksForUser(anyLong())).thenReturn(List.of(activeDeck, deletedDeck));

		StatisticsService service = new StatisticsService(authService, answerEventRepository, cardStateRepository,
				deckRepository, mock(DueStateService.class), new TimeService(), new ScheduleEngine(),
				mock(StatisticsCacheService.class));

		StatisticsResponse response = service.summary(1L, null, "UTC");

		assertEquals(1, response.learnedToday());
		assertEquals(3, response.reviewedToday());
		assertEquals(2, response.tomorrowDue());
		assertEquals(1, response.relearnCount());
		assertEquals(50.0, response.retentionRate());
		assertEquals(2L, response.hourlyDistribution().get("10"));
		assertEquals(1L, response.hourlyDistribution().get("22"));
		assertEquals(4L, response.forecast().day7());
		assertEquals(7L, response.forecast().day30());
		assertEquals(8L, response.forecast().day90());
		assertEquals(9L, response.forecast().day180());
		assertEquals(2, response.deckOptions().size());
		assertEquals("Current", response.deckOptions().get(0).name());
		assertEquals(false, response.deckOptions().get(0).deleted());
		assertEquals("Old", response.deckOptions().get(1).name());
		assertEquals(true, response.deckOptions().get(1).deleted());
		assertNotNull(response.stageDistribution());
		assertNotNull(response.resultCounts());
		assertEquals(2L, response.resultCounts().get("BLURRY"));
	}

	private Card card(Deck deck, Long id) {
		Card card = new Card(deck, "Front " + id, "Back " + id, id);
		ReflectionTestUtils.setField(card, "id", id);
		CardState state = new CardState(card);
		card.setState(state);
		return card;
	}

	private CardState state(Card card, int stage, CardQueue queueType, RelearnMode mode, RelearnOrigin origin,
			LocalDate dueDate, Instant dueSince) {
		CardState state = card.getState();
		state.setStage(stage);
		state.setQueueType(queueType);
		state.setRelearnMode(mode);
		state.setRelearnOrigin(origin);
		state.setDueDate(dueDate);
		state.setDueSince(dueSince);
		return state;
	}

	private AnswerEvent event(Deck deck, Card card, Instant answeredAt, StudyScene scene, StudyQueue queue,
			int stageBefore, int stageAfter, AnswerResult result) {
		LocalDate learningDay = answeredAt.atZone(ZoneOffset.UTC).toLocalDate();
		return new AnswerEvent(new User("event@example.com", "hash"), deck, card, answeredAt, "UTC", learningDay,
				queue, scene, stageBefore, stageAfter, result);
	}
}
