package top.kariscode.karisanki.domain.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.RelearnOrigin;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.StudyScene;

class ScheduleEngineTest {

	private final ScheduleEngine engine = new ScheduleEngine();
	private final LocalDate day = LocalDate.of(2026, 8, 20);
	private final Instant now = Instant.parse("2026-08-20T12:00:00Z");

	@Test
	void newCardFamiliarMovesToStage0AndSchedulesTomorrow() {
		ScheduleResult result = engine.answer(ScheduleState.newCard(), StudyQueue.LEARN, AnswerResult.FAMILIAR, day,
				now, false, false);

		assertEquals(StudyScene.LEARN, result.scene());
		assertEquals(0, result.stageAfter());
		assertEquals(CardQueue.REVIEW, result.state().queueType());
		assertEquals(day.plusDays(1), result.state().dueDate());
		assertNull(result.state().dueSince());
	}

	@Test
	void newCardBlurryAndForgotEnterTheirRelearnModes() {
		ScheduleResult blurry = engine.answer(ScheduleState.newCard(), StudyQueue.LEARN, AnswerResult.BLURRY, day, now,
				false, false);
		ScheduleResult forgot = engine.answer(ScheduleState.newCard(), StudyQueue.LEARN, AnswerResult.FORGOT, day, now,
				false, false);

		assertEquals(-1, blurry.state().stage());
		assertEquals(RelearnMode.BLURRY, blurry.state().relearnMode());
		assertEquals(RelearnOrigin.LEARN, blurry.state().relearnOrigin());
		assertEquals(0, blurry.state().relearnCorrectCount());
		assertEquals(RelearnMode.FORGOT, forgot.state().relearnMode());
	}

	@Test
	void newCardBlurryCompletesAfterThreeFamiliarAnswers() {
		ScheduleResult afterTwo = relearnChain(ScheduleState.newCard(), AnswerResult.BLURRY, 2);
		ScheduleResult afterThree = relearnChain(ScheduleState.newCard(), AnswerResult.BLURRY, 3);

		assertEquals(CardQueue.RELEARN, afterTwo.state().queueType());
		assertEquals(2, afterTwo.state().relearnCorrectCount());
		assertEquals(CardQueue.REVIEW, afterThree.state().queueType());
		assertEquals(0, afterThree.state().stage());
		assertEquals(day.plusDays(1), afterThree.state().dueDate());
	}

	@Test
	void newCardForgotCompletesAfterFiveFamiliarAnswers() {
		ScheduleResult afterFour = relearnChain(ScheduleState.newCard(), AnswerResult.FORGOT, 4);
		ScheduleResult afterFive = relearnChain(ScheduleState.newCard(), AnswerResult.FORGOT, 5);

		assertEquals(CardQueue.RELEARN, afterFour.state().queueType());
		assertEquals(4, afterFour.state().relearnCorrectCount());
		assertEquals(CardQueue.REVIEW, afterFive.state().queueType());
		assertEquals(0, afterFive.state().stage());
	}

	@Test
	void normalFamiliarAdvancesThroughAllIntervals() {
		for (int stage = 0; stage <= 7; stage++) {
			ScheduleState state = review(stage);
			ScheduleResult result = engine.answer(state, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false,
					false);
			assertEquals(stage + 1, result.state().stage());
			assertEquals(day.plusDays(engine.intervalDays(stage + 1)), result.state().dueDate());
		}
	}

	@Test
	void overdueFamiliarAdvancesExactlyOneStageWithoutExtraAdjustment() {
		Instant overdueSince = now.minusSeconds(10L * 24 * 60 * 60);
		for (int stage = 0; stage <= 7; stage++) {
			ScheduleState overdue = new ScheduleState(stage, CardQueue.REVIEW, RelearnMode.NONE, null, 0,
					day.minusDays(30), overdueSince);
			ScheduleResult result = engine.answer(overdue, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false,
					false);
			assertEquals(stage + 1, result.state().stage(), "stage " + stage);
			assertEquals(day.plusDays(engine.intervalDays(stage + 1)), result.state().dueDate(), "stage " + stage);
		}
	}

	@Test
	void stage8CanContinueOrGraduate() {
		ScheduleResult continued = engine.answer(review(8), StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false,
				false);
		ScheduleResult graduated = engine.answer(review(8), StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, true,
				false);

		assertEquals(8, continued.state().stage());
		assertEquals(CardQueue.REVIEW, continued.state().queueType());
		assertEquals(day.plusDays(180), continued.state().dueDate());
		assertEquals(9, graduated.state().stage());
		assertEquals(CardQueue.DONE, graduated.state().queueType());
	}

	@Test
	void lowStageBlurryRelearnCompletesBackToStage0() {
		ScheduleState blurred = engine.answer(review(1), StudyQueue.REVIEW, AnswerResult.BLURRY, day, now, false, false)
				.state();
		assertEquals(1, blurred.stage());
		assertEquals(CardQueue.RELEARN, blurred.queueType());
		assertEquals(RelearnOrigin.REVIEW, blurred.relearnOrigin());

		ScheduleResult completed = relearnChain(blurred, AnswerResult.BLURRY, 3);
		assertEquals(0, completed.state().stage());
		assertEquals(day.plusDays(1), completed.state().dueDate());

		ScheduleResult nextReview = engine.answer(completed.state(), StudyQueue.REVIEW, AnswerResult.FAMILIAR, day.plusDays(1), now,
				false, false);
		assertEquals(1, nextReview.state().stage());
		assertEquals(day.plusDays(2), nextReview.state().dueDate());
	}

	@Test
	void highStageBlurryRelearnStepsBackOneStageThenReturnsOnNextReview() {
		ScheduleState blurred = engine.answer(review(6), StudyQueue.REVIEW, AnswerResult.BLURRY, day, now, false, false)
				.state();
		ScheduleResult completed = relearnChain(blurred, AnswerResult.BLURRY, 3);

		assertEquals(5, completed.state().stage());
		assertEquals(day.plusDays(1), completed.state().dueDate());

		ScheduleResult returned = engine.answer(completed.state(), StudyQueue.REVIEW, AnswerResult.FAMILIAR, day.plusDays(1), now,
				false, false);
		assertEquals(6, returned.state().stage());
		assertEquals(day.plusDays(31), returned.state().dueDate());
	}

	@Test
	void reviewForgetCompletesBackToStage0AndStartsNewCycle() {
		ScheduleState forgot = engine.answer(review(6), StudyQueue.REVIEW, AnswerResult.FORGOT, day, now, false, false)
				.state();
		assertEquals(6, forgot.stage());
		assertEquals(RelearnMode.FORGOT, forgot.relearnMode());

		ScheduleResult completed = relearnChain(forgot, AnswerResult.FORGOT, 5);
		assertEquals(0, completed.state().stage());
		assertEquals(day.plusDays(1), completed.state().dueDate());

		ScheduleResult nextReview = engine.answer(completed.state(), StudyQueue.REVIEW, AnswerResult.FAMILIAR, day.plusDays(1), now,
				false, false);
		assertEquals(1, nextReview.state().stage());
		assertEquals(day.plusDays(2), nextReview.state().dueDate());
	}

	@Test
	void blurryAnswerInsideRelearnResetsCountAndKeepsMode() {
		ScheduleState blurred = new ScheduleState(6, CardQueue.RELEARN, RelearnMode.BLURRY, RelearnOrigin.REVIEW, 2,
				day, now);
		ScheduleResult result = engine.answer(blurred, StudyQueue.REVIEW, AnswerResult.BLURRY, day, now, false, false);

		assertEquals(RelearnMode.BLURRY, result.state().relearnMode());
		assertEquals(0, result.state().relearnCorrectCount());
	}

	@Test
	void blurryAnswerInsideForgotRelearnKeepsForgotMode() {
		ScheduleState forgot = new ScheduleState(4, CardQueue.RELEARN, RelearnMode.FORGOT, RelearnOrigin.REVIEW, 2,
				day, now);
		ScheduleResult result = engine.answer(forgot, StudyQueue.REVIEW, AnswerResult.BLURRY, day, now, false, false);

		assertEquals(RelearnMode.FORGOT, result.state().relearnMode());
		assertEquals(0, result.state().relearnCorrectCount());
	}

	@Test
	void forgetInsideBlurryRelearnRequiresConfirmationAndThenSwitches() {
		ScheduleState blurred = new ScheduleState(6, CardQueue.RELEARN, RelearnMode.BLURRY, RelearnOrigin.REVIEW, 1,
				day, now);

		assertThrows(ConfirmationRequiredException.class,
				() -> engine.answer(blurred, StudyQueue.REVIEW, AnswerResult.FORGOT, day, now, false, false));

		ScheduleResult confirmed = engine.answer(blurred, StudyQueue.REVIEW, AnswerResult.FORGOT, day, now, false,
				true);
		assertEquals(RelearnMode.FORGOT, confirmed.state().relearnMode());
		assertEquals(0, confirmed.state().relearnCorrectCount());
	}

	@Test
	void graduatedCardCannotBeAnswered() {
		ScheduleState done = new ScheduleState(9, CardQueue.DONE, RelearnMode.NONE, null, 0, null, null);
		assertThrows(SchedulingConflictException.class,
				() -> engine.answer(done, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false, false));

		ScheduleState stageNine = new ScheduleState(9, CardQueue.REVIEW, RelearnMode.NONE, null, 0, day, null);
		assertThrows(SchedulingConflictException.class,
				() -> engine.answer(stageNine, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false, false));
	}

	@Test
	void reviewCardMustBeDueBeforeAnswering() {
		ScheduleState future = new ScheduleState(0, CardQueue.REVIEW, RelearnMode.NONE, null, 0, day.plusDays(1), null);
		assertThrows(SchedulingConflictException.class,
				() -> engine.answer(future, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false, false));

		ScheduleState markedDue = new ScheduleState(0, CardQueue.REVIEW, RelearnMode.NONE, null, 0, day.plusDays(1), now);
		ScheduleResult result = engine.answer(markedDue, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false, false);
		assertEquals(1, result.state().stage());
	}

	@Test
	void allStagesBlurryRelearnStepsBackToOneForHighStages() {
		for (int stage = 0; stage <= 8; stage++) {
			ScheduleState blurred = engine.answer(review(stage), StudyQueue.REVIEW, AnswerResult.BLURRY, day, now, false,
					false).state();
			ScheduleResult completed = relearnChain(blurred, AnswerResult.BLURRY, 3);
			int expected = stage <= 1 ? 0 : stage - 1;
			assertEquals(expected, completed.state().stage(), "stage " + stage);
			assertEquals(day.plusDays(1), completed.state().dueDate(), "stage " + stage);
		}
	}

	@Test
	void allStagesForgotRelearnResetsToStage0() {
		for (int stage = 0; stage <= 8; stage++) {
			ScheduleState forgot = engine.answer(review(stage), StudyQueue.REVIEW, AnswerResult.FORGOT, day, now, false,
					false).state();
			ScheduleResult completed = relearnChain(forgot, AnswerResult.FORGOT, 5);
			assertEquals(0, completed.state().stage(), "stage " + stage);
			assertEquals(day.plusDays(1), completed.state().dueDate(), "stage " + stage);
		}
	}

	@Test
	void wrongQueueIsRejected() {
		assertThrows(SchedulingConflictException.class,
				() -> engine.answer(ScheduleState.newCard(), StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false,
						false));
		assertThrows(SchedulingConflictException.class,
				() -> engine.answer(review(0), StudyQueue.LEARN, AnswerResult.FAMILIAR, day, now, false, false));
	}

	@Test
	void relearnCardCannotEnterTheOtherQueue() {
		ScheduleState blurred = new ScheduleState(0, CardQueue.RELEARN, RelearnMode.BLURRY, RelearnOrigin.LEARN, 1,
				day, now);
		assertThrows(SchedulingConflictException.class,
				() -> engine.answer(blurred, StudyQueue.REVIEW, AnswerResult.FAMILIAR, day, now, false, false));
	}

	@ParameterizedTest
	@CsvSource({
			"1,1",
			"2,2",
			"3,4",
			"4,7",
			"5,15",
			"6,30",
			"7,90",
			"8,180"
	})
	void intervalMappingMatchesSpec(int stage, int expectedDays) {
		assertEquals(expectedDays, engine.intervalDays(stage));
	}

	@ParameterizedTest
	@MethodSource("contractScheduleVectors")
	void contractScheduleVectorsMatchEngine(JsonNode vector) {
		ScheduleState state = parseState(vector.get("state"));
		StudyQueue queue = StudyQueue.valueOf(vector.get("queueType").asText());
		AnswerResult result = AnswerResult.valueOf(vector.get("result").asText());
		boolean graduate = vector.path("graduate").asBoolean(false);

		ScheduleResult actual = engine.answer(state, queue, result, day, now, graduate, false);
		JsonNode expected = vector.get("expected");

		assertEquals(expected.get("stage").asInt(), actual.state().stage());
		assertEquals(CardQueue.valueOf(expected.get("queueType").asText()), actual.state().queueType());
		if (expected.has("relearnMode")) {
			assertEquals(RelearnMode.valueOf(expected.get("relearnMode").asText()), actual.state().relearnMode());
		}
		if (expected.has("relearnOrigin")) {
			assertEquals(expected.hasNonNull("relearnOrigin") ? RelearnOrigin.valueOf(expected.get("relearnOrigin").asText()) : null, actual.state().relearnOrigin());
		}
		if (expected.has("relearnCorrectCount")) {
			assertEquals(expected.get("relearnCorrectCount").asInt(), actual.state().relearnCorrectCount());
		}
		if (expected.has("dueOffsetDays")) {
			assertEquals(day.plusDays(expected.get("dueOffsetDays").asLong()), actual.state().dueDate());
		} else if (expected.has("dueDate")) {
			assertEquals(expected.hasNonNull("dueDate") ? LocalDate.parse(expected.get("dueDate").asText()) : null, actual.state().dueDate());
		}
		if (expected.has("dueSince")) {
			assertEquals(expected.hasNonNull("dueSince") ? Instant.parse(expected.get("dueSince").asText()) : null, actual.state().dueSince());
		}
	}

	private static Stream<Arguments> contractScheduleVectors() throws Exception {
		JsonNode root = new ObjectMapper().readTree(Files.readString(Path.of("..", "contracts", "scheduling-vectors.json")));
		List<Arguments> vectors = new ArrayList<>();
		root.get("schedule").forEach(node -> vectors.add(Arguments.of(node)));
		return vectors.stream();
	}

	private ScheduleState parseState(JsonNode node) {
		return new ScheduleState(node.get("stage").asInt(), CardQueue.valueOf(node.get("queueType").asText()),
				RelearnMode.valueOf(node.get("relearnMode").asText()),
				node.hasNonNull("relearnOrigin") ? RelearnOrigin.valueOf(node.get("relearnOrigin").asText()) : null,
				node.get("relearnCorrectCount").asInt(),
				node.hasNonNull("dueDate") ? LocalDate.parse(node.get("dueDate").asText()) : null,
				node.hasNonNull("dueSince") ? Instant.parse(node.get("dueSince").asText()) : null);
	}

	private ScheduleState review(int stage) {
		return new ScheduleState(stage, CardQueue.REVIEW, RelearnMode.NONE, null, 0, day, null);
	}

	private ScheduleResult relearnChain(ScheduleState start, AnswerResult initialResult, int familiarCount) {
		ScheduleResult current;
		if (start.queueType() == CardQueue.NEW) {
			current = engine.answer(start, StudyQueue.LEARN, initialResult, day, now, false, false);
		}
		else {
			current = new ScheduleResult(start, StudyScene.RELEARN, start.stage(), start.stage());
		}
		for (int i = 0; i < familiarCount; i++) {
			current = engine.answer(current.state(), queueFor(current.state()), AnswerResult.FAMILIAR, day, now, false,
					false);
		}
		return current;
	}

	private StudyQueue queueFor(ScheduleState state) {
		return state.relearnOrigin() == RelearnOrigin.LEARN ? StudyQueue.LEARN : StudyQueue.REVIEW;
	}
}
