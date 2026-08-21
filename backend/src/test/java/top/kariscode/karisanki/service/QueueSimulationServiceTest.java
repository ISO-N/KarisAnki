package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.util.ReflectionTestUtils;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.RelearnOrigin;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.deck.Deck;
import top.kariscode.karisanki.domain.scheduling.ScheduleEngine;
import top.kariscode.karisanki.domain.scheduling.ScheduleState;
import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.service.QueueService.QueueSnapshot;

class QueueSimulationServiceTest {

	private final QueueSimulationService simulation = new QueueSimulationService();
	private final ScheduleEngine engine = new ScheduleEngine();
	private final LocalDate day = LocalDate.of(2026, 8, 20);
	private final Instant now = Instant.parse("2026-08-20T12:00:00Z");

	@ParameterizedTest
	@MethodSource("queueVectors")
	void sharedQueueVectorsMatch(JsonNode vector) {
		QueueSnapshot snapshot = snapshot(vector);
		QueueSimulationService.MutableQueue queue = simulation.create(snapshot);
		Card card = queue.card(vector.get("cardId").asLong());
		CardState cardState = card.getState();
		ScheduleState previous = new ScheduleState(cardState.getStage(), cardState.getQueueType(),
				cardState.getRelearnMode(), cardState.getRelearnOrigin(), cardState.getRelearnCorrectCount(),
				cardState.getDueDate(), cardState.getDueSince());
		ScheduleState next = engine.answer(previous, StudyQueue.valueOf(vector.get("queueType").asText()),
				AnswerResult.valueOf(vector.get("result").asText()), day, now, false, false).state();

		QueueSimulationService.AdvanceResult result = simulation.advance(queue, card, previous, next);

		List<Long> expected = new ArrayList<>();
		vector.get("expectedOrder").forEach(item -> expected.add(item.asLong()));
		assertEquals(expected, result.order(), vector.get("name").asText());
	}

	@Test
	void emptyQueueAfterLastCardCompletes() {
		User user = new User("user@example.com", "hash");
		Deck deck = new Deck(user, "Deck");
		Card card = card(deck, 1L, CardQueue.NEW, RelearnMode.NONE, 0);
		QueueSnapshot snapshot = new QueueSnapshot(List.of(1L), List.of(card));
		QueueSimulationService.MutableQueue queue = simulation.create(snapshot);

		CardState state = card.getState();
		ScheduleState previous = new ScheduleState(state.getStage(), state.getQueueType(), state.getRelearnMode(),
				state.getRelearnOrigin(), state.getRelearnCorrectCount(), state.getDueDate(), state.getDueSince());
		ScheduleState next = engine.answer(previous, StudyQueue.LEARN, AnswerResult.FAMILIAR, day, now, false, false)
				.state();
		QueueSimulationService.AdvanceResult result = simulation.advance(queue, card, previous, next);

		assertEquals(List.of(), result.order());
		assertNull(result.nextCardId());
	}

	private static Stream<Arguments> queueVectors() throws Exception {
		JsonNode root = new ObjectMapper().readTree(Files.readString(Path.of("..", "contracts", "scheduling-vectors.json")));
		List<Arguments> vectors = new ArrayList<>();
		root.get("queue").forEach(node -> vectors.add(Arguments.of(node)));
		return vectors.stream();
	}

	private QueueSnapshot snapshot(JsonNode vector) {
		List<Long> order = new ArrayList<>();
		vector.get("order").forEach(id -> order.add(id.asLong()));
		List<Card> cards = new ArrayList<>();
		vector.get("cards").forEach(item -> cards.add(card(deck(), item.get("id").asLong(), item)));
		return new QueueSnapshot(order, cards);
	}

	private Deck deck() {
		return new Deck(new User("user@example.com", "hash"), "Deck");
	}

	private Card card(Deck deck, Long id, JsonNode item) {
		Card card = new Card(deck, "Front " + id, "Back " + id, id);
		ReflectionTestUtils.setField(card, "id", id);
		CardState state = new CardState(card);
		state.setStage(item.get("stage").asInt());
		if ("relearn".equals(item.get("status").asText())) {
			state.setQueueType(CardQueue.RELEARN);
			state.setRelearnMode(RelearnMode.valueOf(item.get("relearnMode").asText()));
			state.setRelearnOrigin(RelearnOrigin.LEARN);
			state.setRelearnCorrectCount(item.get("relearnCorrectCount").asInt());
		} else {
			state.setQueueType(CardQueue.NEW);
			state.setRelearnMode(RelearnMode.NONE);
			state.setRelearnCorrectCount(0);
		}
		card.setState(state);
		return card;
	}

	private Card card(Deck deck, Long id, CardQueue queueType, RelearnMode mode, int correctCount) {
		Card card = new Card(deck, "Front " + id, "Back " + id, id);
		ReflectionTestUtils.setField(card, "id", id);
		CardState state = new CardState(card);
		state.setStage(-1);
		state.setQueueType(queueType);
		state.setRelearnMode(mode);
		if (queueType == CardQueue.RELEARN) {
			state.setRelearnOrigin(RelearnOrigin.LEARN);
		}
		state.setRelearnCorrectCount(correctCount);
		card.setState(state);
		return card;
	}
}
