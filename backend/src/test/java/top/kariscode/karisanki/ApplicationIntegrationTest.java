package top.kariscode.karisanki;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.session.SessionRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import jakarta.servlet.http.Cookie;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import top.kariscode.karisanki.security.SessionRegistryService;
import top.kariscode.karisanki.domain.deck.AnswerEvent;
import top.kariscode.karisanki.domain.user.UserSession;
import top.kariscode.karisanki.repository.AnswerEventRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.UserSessionRepository;

@SpringBootTest
@AutoConfigureMockMvc
class ApplicationIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private CardStateRepository cardStateRepository;

	@Autowired
	private AnswerEventRepository answerEventRepository;

	@Autowired
	private SessionRegistryService sessionRegistryService;
	@Autowired
	private UserSessionRepository userSessionRepository;

	@Autowired
	private SessionRepository<?> sessionRepository;

	@Test
	void authLifecycleCoversRegisterLoginLogoutSettingsAndPassword() throws Exception {
		String email = uniqueEmail();
		MvcResult register = register(email, "password123", "testcode");
		assertStatus(register, 201);
		String cookie = sessionCookie(register);

		MvcResult duplicate = register(email, "password123", "testcode");
		assertStatus(duplicate, 409);

		MvcResult invalidInvite = register(uniqueEmail(), "password123", "wrong");
		assertStatus(invalidInvite, 400);

		MvcResult wrongLogin = login(email, "wrongpass", false);
		assertStatus(wrongLogin, 401);

		MvcResult login = login(email, "password123", false);
		assertStatus(login, 200);
		String loginCookie = sessionCookie(login);

		getMe(loginCookie).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));

		putJson("/api/settings/password", "{\"currentPassword\":\"wrongpass\",\"newPassword\":\"newpass123\"}",
				loginCookie).andExpect(status().isBadRequest());

		putJson("/api/settings/password", "{\"currentPassword\":\"password123\",\"newPassword\":\"newpass123\"}",
				loginCookie).andExpect(status().isOk());

		MvcResult oldPasswordLogin = login(email, "password123", false);
		assertStatus(oldPasswordLogin, 401);
		MvcResult newPasswordLogin = login(email, "newpass123", true);
		assertStatus(newPasswordLogin, 200);
		String newLoginCookie = sessionCookie(newPasswordLogin);

		putJson("/api/settings",
				"{\"refreshTime\":\"06:00:00\",\"language\":\"EN\",\"theme\":\"DARK\"}", newLoginCookie)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.refreshTime").value("06:00:00"))
				.andExpect(jsonPath("$.theme").value("DARK"));

		MvcResult secondLogin = login(email, "newpass123", true);
		assertStatus(secondLogin, 200);
		String secondCookie = sessionCookie(secondLogin);
		getMe(secondCookie).andExpect(status().isOk());

		postNoBody("/api/auth/logout-all", secondCookie).andExpect(status().isNoContent());
		getMe(loginCookie).andExpect(status().isUnauthorized());
		getMe(newLoginCookie).andExpect(status().isUnauthorized());

		MvcResult freshLogin = login(email, "newpass123", false);
		assertStatus(freshLogin, 200);
		String freshCookie = sessionCookie(freshLogin);
		postNoBody("/api/auth/logout", freshCookie).andExpect(status().isNoContent());
		getMe(freshCookie).andExpect(status().isUnauthorized());

		MvcResult expiredLogin = login(email, "newpass123", false);
		assertStatus(expiredLogin, 200);
		String expiredCookie = sessionCookie(expiredLogin);
		getMe(expiredCookie).andExpect(status().isOk());
		sessionRepository.deleteById(sessionId(expiredCookie));
		getMe(expiredCookie).andExpect(status().isUnauthorized());
	}

	@Test
	void deckAndCardManagementSupportsSearchFiltersResetAndIsolation() throws Exception {
		String userA = registerAndLogin();
		String userB = registerAndLogin();

		MvcResult deckCreated = postJson("/api/decks", "{\"name\":\"Biology\"}", userA).andExpect(status().isCreated())
				.andReturn();
		long deckId = jsonLong(deckCreated, "$.id");

		long cardOne = createCard(deckId, "Mitochondria", "$E=mc^2$", userA);
		long cardTwo = createCard(deckId, "DNA", "**double helix**", userA);

		getJson("/api/decks/" + deckId + "/cards?q=dna&page=0", userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1))
				.andExpect(jsonPath("$.items[0].id").value(cardTwo));

		getJson("/api/decks/" + deckId + "/cards?status=new&page=0", userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(2));

		answerCard(cardOne, "FAMILIAR", "LEARN", "UTC", userA)
				.andExpect(status().isOk());

		putJson("/api/cards/" + cardOne, "{\"front\":\"Mitochondria updated\",\"back\":\"still unchanged\"}", userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.stage").value(0));

		getJson("/api/decks/" + deckId + "/cards?status=review&page=0", userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1));

		postNoBody("/api/cards/" + cardOne + "/reset", userA).andExpect(status().isNoContent());
		getJson("/api/cards/" + cardOne, userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.stage").value(-1))
				.andExpect(jsonPath("$.status").value("new"));

		postNoBody("/api/decks/" + deckId + "/reset?timezone=UTC", userA).andExpect(status().isNoContent());
		getJson("/api/decks/" + deckId + "/cards?page=0", userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].id").value(cardOne))
				.andExpect(jsonPath("$.items[1].id").value(cardTwo));

		getJson("/api/decks/" + deckId + "/cards?page=0", userB).andExpect(status().isNotFound());
		patchJson("/api/decks/" + deckId, "{\"name\":\"Hijack\"}", userB).andExpect(status().isNotFound());
		deleteJson("/api/decks/" + deckId, userB).andExpect(status().isNotFound());
		getJson("/api/cards/" + cardOne, userB).andExpect(status().isNotFound());

		deleteJson("/api/cards/" + cardOne, userA).andExpect(status().isNoContent());
		getJson("/api/decks/" + deckId + "/cards?q=mitochondria&page=0", userA)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(0));
	}

	@Test
	void queuesRebuildFromStateAndRelearnCardsReinsert() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Queue Deck", user);
		long cardOne = createCard(deckId, "One", "", user);
		long cardTwo = createCard(deckId, "Two", "", user);
		long cardThree = createCard(deckId, "Three", "", user);

		getJson("/api/decks/" + deckId + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds", hasSize(3)))
				.andExpect(jsonPath("$.cardIds[0]").value(cardOne));

		answerCard(cardOne, "BLURRY", "LEARN", "UTC", user)
				.andExpect(jsonPath("$.accepted").value(true))
				.andExpect(jsonPath("$.nextCardId").value(cardTwo));

		answerCard(cardTwo, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		getJson("/api/decks/" + deckId + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(cardThree))
				.andExpect(jsonPath("$.cardIds[1]").value(cardOne));

		long staleVersion = jsonNode(getJson("/api/cards/" + cardOne, user).andReturn()).get("stateVersion").asLong();
		answerCard(cardOne, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(jsonPath("$.accepted").value(true))
				.andExpect(jsonPath("$.nextCardId").value(cardThree));

		postJson("/api/answer",
				"{\"clientAnswerId\":\"stale-" + System.nanoTime() + "\",\"cardId\":"
						+ cardOne + ",\"result\":\"BLURRY\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + staleVersion + "}",
				user).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("queue_refresh"));

		postNoBody("/api/cards/" + cardThree + "/reset", user).andExpect(status().isNoContent());
		postNoBody("/api/decks/" + deckId + "/reset?timezone=UTC", user).andExpect(status().isNoContent());

		long dueCard = createCard(deckId, "Due", "", user);
		answerCard(dueCard, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());
		// Force the freshly learned card due today so the review queue includes it.
		Long userId = userIdFromCookie(user);
		var state = cardStateRepository.findActiveByCardIdForUser(dueCard, userId).orElseThrow();
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);

		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(dueCard));

		var dueState = cardStateRepository.findActiveByCardIdForUser(dueCard, userId).orElseThrow();
		assertNotNull(dueState.getDueSince());
	}

	@Test
	void cardPaginationReturnsFiftyPerPage() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Pagination", user);
		long firstCard = createCard(deckId, "Card 1", "", user);
		for (int index = 2; index <= 55; index++) {
			createCard(deckId, "Card " + index, "", user);
		}

		getJson("/api/decks/" + deckId + "/cards?page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(55))
				.andExpect(jsonPath("$.items", hasSize(50)))
				.andExpect(jsonPath("$.items[0].id").value(firstCard));

		getJson("/api/decks/" + deckId + "/cards?page=1", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(55))
				.andExpect(jsonPath("$.items", hasSize(5)));
	}

	@Test
	void statisticsKeepHistoryAcrossDeleteAndRename() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Original", user);
		long card = createCard(deckId, "Question", "Answer", user);

		answerCard(card, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		patchJson("/api/decks/" + deckId, "{\"name\":\"Renamed\"}", user).andExpect(status().isOk());

		getJson("/api/statistics?timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.learnedToday").value(1))
				.andExpect(jsonPath("$.reviewedToday").value(0))
				.andExpect(jsonPath("$.stageDistribution.0").value(1))
				.andExpect(jsonPath("$.resultCounts.FAMILIAR").value(1))
				.andExpect(jsonPath("$.deckOptions[0].name").value("Renamed"));

		deleteJson("/api/cards/" + card, user).andExpect(status().isNoContent());

		getJson("/api/statistics?timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.learnedToday").value(1))
				.andExpect(jsonPath("$.stageDistribution.0").value(0));
	}

	@Test
	void learningRelearnCompletionCountsOnlyAsLearnedToday() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Learn Relearn", user);
		long card = createCard(deckId, "Question", "Answer", user);

		answerCard(card, "BLURRY", "LEARN", "UTC", user).andExpect(status().isOk());
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());

		JsonNode stats = jsonNode(getJson("/api/statistics?timezone=UTC", user)
				.andExpect(status().isOk()).andReturn());
		assertEquals(1, stats.get("learnedToday").asLong());
		assertEquals(0, stats.get("reviewedToday").asLong());
	}

	@Test
	void reviewTriggeredRelearnCountsAsReviewedToday() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		long deckId = createDeck("Review Relearn", user);
		long card = createCard(deckId, "Question", "Answer", user);
		setReviewState(card, 0, LocalDate.now(ZoneOffset.UTC), userId);

		answerCard(card, "BLURRY", "REVIEW", "UTC", user).andExpect(status().isOk());
		answerCard(card, "FAMILIAR", "REVIEW", "UTC", user).andExpect(status().isOk());

		JsonNode stats = jsonNode(getJson("/api/statistics?timezone=UTC", user)
				.andExpect(status().isOk()).andReturn());
		assertEquals(0, stats.get("learnedToday").asLong());
		assertEquals(2, stats.get("reviewedToday").asLong());
	}

	@Test
	void deckCountsSplitRelearnByOrigin() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		long deckId = createDeck("Split Relearn", user);
		long learnCard = createCard(deckId, "Learn Relearn", "", user);
		long reviewCard = createCard(deckId, "Review Relearn", "", user);
		setRelearnState(learnCard, -1, 1, userId);

		var reviewState = cardStateRepository.findActiveByCardIdForUser(reviewCard, userId).orElseThrow();
		reviewState.setStage(0);
		reviewState.setQueueType(top.kariscode.karisanki.domain.CardQueue.RELEARN);
		reviewState.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.BLURRY);
		reviewState.setRelearnOrigin(top.kariscode.karisanki.domain.RelearnOrigin.REVIEW);
		reviewState.setRelearnCorrectCount(1);
		reviewState.setDueDate(LocalDate.now(ZoneOffset.UTC));
		reviewState.setDueSince(null);
		cardStateRepository.save(reviewState);

		getJson("/api/decks?timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].relearnCount").value(2))
				.andExpect(jsonPath("$[0].learnRelearnCount").value(1))
				.andExpect(jsonPath("$[0].reviewRelearnCount").value(1));
	}

	@Test
	void statisticsReportTomorrowRelearnRetentionAndForecast() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Stats", user);
		long learnedCard = createCard(deckId, "Learned", "", user);
		long relearnCard = createCard(deckId, "Relearn", "", user);

		answerCard(learnedCard, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		answerCard(relearnCard, "BLURRY", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		Long userId = userIdFromCookie(user);
		var state = cardStateRepository.findActiveByCardIdForUser(learnedCard, userId).orElseThrow();
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);

		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=UTC", user).andExpect(status().isOk());

		answerCard(learnedCard, "FAMILIAR", "REVIEW", "UTC", user)
				.andExpect(status().isOk());

		answerCard(relearnCard, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		MvcResult statsResult = getJson("/api/statistics?timezone=UTC", user).andExpect(status().isOk()).andReturn();
		JsonNode stats = jsonNode(statsResult);
		assertEquals(1, stats.get("learnedToday").asLong());
		assertEquals(1, stats.get("reviewedToday").asLong());
		assertEquals(2, stats.get("tomorrowDue").asLong());
		assertEquals(1, stats.get("relearnCount").asLong());
		assertEquals(100.0, stats.get("retentionRate").asDouble(), 0.001);
		assertEquals(3, stats.get("resultCounts").get("FAMILIAR").asLong());
		assertEquals(4, stats.get("forecast").get("day7").asLong());
		assertEquals(6, stats.get("forecast").get("day30").asLong());
		assertEquals(24, stats.get("hourlyDistribution").size());
		List<AnswerEvent> events = answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId);
		String expectedHour = String.valueOf(events.get(events.size() - 1).getAnsweredAt().atZone(ZoneId.of("UTC")).getHour());
		assertTrue(stats.get("hourlyDistribution").get(expectedHour).asLong() >= 1);
	}

	@Test
	void authCookieAndCrossDeviceSettingsPersist() throws Exception {
		String email = uniqueEmail();
		MvcResult firstRegister = register(email, "password123", "testcode");
		assertStatus(firstRegister, 201);
		String firstCookie = sessionCookie(firstRegister);
		String firstHeader = firstRegister.getResponse().getHeader("Set-Cookie");
		assertNotNull(firstHeader);
		assertTrue(firstHeader.contains("HttpOnly"));
		assertTrue(firstHeader.contains("SameSite=Lax"));
		assertTrue(firstHeader.contains("Path=/"));
		assertEquals(-1, firstRegister.getResponse().getCookies()[0].getMaxAge());

		MvcResult remembered = login(email, "password123", true);
		assertStatus(remembered, 200);
		assertEquals(2592000, remembered.getResponse().getCookies()[0].getMaxAge());

		MvcResult secondLogin = login(email, "password123", true);
		assertStatus(secondLogin, 200);
		String secondCookie = sessionCookie(secondLogin);
		putJson("/api/settings", "{\"refreshTime\":\"06:00:00\",\"language\":\"EN\",\"theme\":\"DARK\"}",
				secondCookie).andExpect(status().isOk());
		getMe(firstCookie).andExpect(status().isOk())
				.andExpect(jsonPath("$.settings.refreshTime").value("06:00:00"))
				.andExpect(jsonPath("$.settings.language").value("EN"))
				.andExpect(jsonPath("$.settings.theme").value("DARK"));

		postNoBody("/api/auth/logout", firstCookie).andExpect(status().isNoContent());
		getMe(firstCookie).andExpect(status().isUnauthorized());
		getMe(secondCookie).andExpect(status().isOk());
	}

	@Test
	void deckOrderValidationAndSoftDeleteCascade() throws Exception {
		String user = registerAndLogin();
		long first = createDeck("First", user);
		long second = createDeck("Second", user);
		getJson("/api/decks?timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(second))
				.andExpect(jsonPath("$[1].id").value(first));

		long card = createCard(first, "Front", null, user);
		postJson("/api/decks/" + first + "/cards", "{\"front\":\"   \",\"back\":\"x\"}", user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation_error"));
		JsonNode cardResponse = jsonNode(getJson("/api/cards/" + card, user).andReturn());
		assertTrue(cardResponse.get("back").isNull());

		getJson("/api/decks?timezone=UTC", "invalid").andExpect(status().isUnauthorized());
		deleteJson("/api/decks/" + first, user).andExpect(status().isNoContent());
		getJson("/api/decks/" + first + "/cards?page=0", user).andExpect(status().isNotFound());
		getJson("/api/cards/" + card, user).andExpect(status().isNotFound());
	}

	@Test
	void resetCardReturnsToFrontOfLearnQueue() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Reset", user);
		long first = createCard(deckId, "First", "", user);
		long second = createCard(deckId, "Second", "", user);
		answerCard(first, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());
		answerCard(second, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		postNoBody("/api/cards/" + first + "/reset", user).andExpect(status().isNoContent());
		getJson("/api/decks/" + deckId + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(first));
	}

	@Test
	void statisticsSingleDeckUsesSelectedDeckCardStates() throws Exception {
		String user = registerAndLogin();
		long deckA = createDeck("Deck A", user);
		long deckB = createDeck("Deck B", user);
		long learnedA = createCard(deckA, "Learned A", "", user);
		long relearnA = createCard(deckA, "Relearn A", "", user);
		long learnedB = createCard(deckB, "Learned B", "", user);
		answerCard(learnedA, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());
		answerCard(relearnA, "BLURRY", "LEARN", "UTC", user)
				.andExpect(status().isOk());
		answerCard(learnedB, "FAMILIAR", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		JsonNode selected = jsonNode(getJson("/api/statistics?timezone=UTC&deckId=" + deckA, user).andReturn());
		assertEquals(1, selected.get("learnedToday").asLong());
		assertEquals(1, selected.get("stageDistribution").get("-1").asLong());
		assertEquals(1, selected.get("stageDistribution").get("0").asLong());
		assertEquals(1, selected.get("relearnCount").asLong());
		assertEquals(1, selected.get("resultCounts").get("FAMILIAR").asLong());
		assertEquals(1, selected.get("resultCounts").get("BLURRY").asLong());

		JsonNode other = jsonNode(getJson("/api/statistics?timezone=UTC&deckId=" + deckB, user).andReturn());
		assertEquals(1, other.get("learnedToday").asLong());
		assertEquals(0, other.get("relearnCount").asLong());
		assertEquals(1, other.get("stageDistribution").get("0").asLong());
		assertEquals(0, other.get("stageDistribution").get("-1").asLong());
	}

	@Test
	void dueStateRemainsDueAfterTimezoneRollback() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Timezone", user);
		long card = createCard(deckId, "Due", "", user);
		Long userId = userIdFromCookie(user);
		var state = cardStateRepository.findActiveByCardIdForUser(card, userId).orElseThrow();
		state.setStage(0);
		state.setQueueType(top.kariscode.karisanki.domain.CardQueue.REVIEW);
		state.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.NONE);
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);

		getJson("/api/decks?timezone=Pacific/Kiritimati", user).andExpect(status().isOk());
		var marked = cardStateRepository.findActiveByCardIdForUser(card, userId).orElseThrow();
		assertNotNull(marked.getDueSince());

		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=Pacific/Midway", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(card));
	}

	@Test
	void reviewQueueOrdersByDueDateAndSingleRelearnRepeatsImmediately() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Review Order", user);
		long cardA = createCard(deckId, "A", "", user);
		long cardB = createCard(deckId, "B", "", user);
		long cardC = createCard(deckId, "C", "", user);
		Long userId = userIdFromCookie(user);
		setReviewState(cardA, 2, LocalDate.now(ZoneOffset.UTC).minusDays(3), userId);
		setReviewState(cardB, 1, LocalDate.now(ZoneOffset.UTC).minusDays(1), userId);
		setReviewState(cardC, 0, LocalDate.now(ZoneOffset.UTC).minusDays(2), userId);

		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(cardA))
				.andExpect(jsonPath("$.cardIds[1]").value(cardC))
				.andExpect(jsonPath("$.cardIds[2]").value(cardB));

		long relearnDeck = createDeck("Relearn Only", user);
		long only = createCard(relearnDeck, "Only", "", user);
		var relearnState = cardStateRepository.findActiveByCardIdForUser(only, userId).orElseThrow();
		relearnState.setStage(0);
		relearnState.setQueueType(top.kariscode.karisanki.domain.CardQueue.RELEARN);
		relearnState.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.BLURRY);
		relearnState.setRelearnOrigin(top.kariscode.karisanki.domain.RelearnOrigin.REVIEW);
		relearnState.setRelearnCorrectCount(0);
		relearnState.setDueDate(LocalDate.now(ZoneOffset.UTC));
		relearnState.setDueSince(null);
		cardStateRepository.save(relearnState);

		getJson("/api/decks/" + relearnDeck + "/queue?type=REVIEW&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(only));
	}

	@Test
	void forgetInsideBlurryRelearnRequiresConfirmationThroughApi() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Confirm", user);
		long card = createCard(deckId, "Card", "", user);
		answerCard(card, "BLURRY", "LEARN", "UTC", user)
				.andExpect(status().isOk());

		long version = jsonNode(getJson("/api/cards/" + card, user).andReturn()).get("stateVersion").asLong();
		postJson("/api/answer",
				"{\"clientAnswerId\":\"confirm-" + System.nanoTime() + "\",\"cardId\":"
						+ card + ",\"result\":\"FORGOT\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + version + "}",
				user).andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("confirmation_required"));

		postJson("/api/answer",
				"{\"clientAnswerId\":\"confirm-ok-" + System.nanoTime() + "\",\"cardId\":"
						+ card + ",\"result\":\"FORGOT\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + version + ",\"confirmForget\":true}",
				user).andExpect(status().isOk());
		getJson("/api/cards/" + card, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.relearnMode").value("FORGOT"));
	}

	@Test
	void answerWithoutStateVersionIsRejected() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Version", user);
		long card = createCard(deckId, "Card", "", user);

		String body = "{\"clientAnswerId\":\"missing-version-" + System.nanoTime() + "\",\"cardId\":" + card + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}";
		postJson("/api/answer", body, user).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation_error"));
	}

	@Test
	void newAccountUsesDefaultSettingsAndRejectsNonQuarterHourRefresh() throws Exception {
		String email = uniqueEmail();
		MvcResult created = postJson("/api/auth/register",
				"{\"email\":\"" + email + "\",\"password\":\"password123\",\"inviteCode\":\"testcode\"}",
				null).andReturn();
		assertStatus(created, 201);
		String user = sessionCookie(created);

		getMe(user).andExpect(status().isOk())
				.andExpect(jsonPath("$.settings.refreshTime").value("04:00:00"))
				.andExpect(jsonPath("$.settings.language").value("EN"))
				.andExpect(jsonPath("$.settings.theme").value("SYSTEM"));

		putJson("/api/settings", "{\"refreshTime\":\"06:07:00\",\"language\":\"EN\",\"theme\":\"DARK\"}",
				user).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("invalid_refresh_time"));
	}

	@Test
	void cardSearchMatchesBackAndEscapesLikeWildcards() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Search", user);
		long percentCard = createCard(deckId, "discount", "save 100%", user);
		long percentLookalike = createCard(deckId, "100x", "", user);
		long underscoreCard = createCard(deckId, "a_c", "snake", user);
		createCard(deckId, "abc", "", user);

		getJson("/api/decks/" + deckId + "/cards?q=snake&page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1))
				.andExpect(jsonPath("$.items[0].id").value(underscoreCard));

		MockHttpServletRequestBuilder percentRequest = get("/api/decks/" + deckId + "/cards")
				.param("q", "100%").param("page", "0");
		withCookie(percentRequest, user);
		mockMvc.perform(percentRequest)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1))
				.andExpect(jsonPath("$.items[0].id").value(percentCard));

		getJson("/api/decks/" + deckId + "/cards?q=a_c&page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1))
				.andExpect(jsonPath("$.items[0].id").value(underscoreCard));
		assertTrue(percentLookalike > 0);
	}

	@Test
	void editingCardPreservesRelearnProgressAndSchedule() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Edit Relearn", user);
		long card = createCard(deckId, "Original", "", user);

		answerCard(card, "BLURRY", "LEARN", "UTC", user).andExpect(status().isOk());
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());

		JsonNode before = jsonNode(getJson("/api/cards/" + card, user).andReturn());
		putJson("/api/cards/" + card, "{\"front\":\"Updated\",\"back\":\"new back\"}", user)
				.andExpect(status().isOk());
		JsonNode after = jsonNode(getJson("/api/cards/" + card, user).andReturn());
		assertEquals(before.get("stage").asInt(), after.get("stage").asInt());
		assertEquals(before.get("relearnMode").asText(), after.get("relearnMode").asText());
		assertEquals(before.get("relearnCorrectCount").asInt(), after.get("relearnCorrectCount").asInt());
		assertEquals(before.get("dueDate").asText(), after.get("dueDate").asText());
		assertEquals(before.get("stateVersion").asLong(), after.get("stateVersion").asLong());
	}

	@Test
	void deletedCardIsRemovedFromQueueAndForecast() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Deleted Queue", user);
		long card = createCard(deckId, "Soon deleted", "", user);
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());

		Long userId = userIdFromCookie(user);
		var state = cardStateRepository.findActiveByCardIdForUser(card, userId).orElseThrow();
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);

		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(card));

		deleteJson("/api/cards/" + card, user).andExpect(status().isNoContent());
		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds", hasSize(0)));

		JsonNode stats = jsonNode(getJson("/api/statistics?timezone=UTC", user).andReturn());
		assertEquals(0, stats.get("forecast").get("day7").asLong());
		assertEquals(0, stats.get("forecast").get("day180").asLong());
	}

	@Test
	void relearnInsertionUsesExponentialOffsetAndTailFallback() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		long deckId = createDeck("Insertion", user);
		long c1 = createCard(deckId, "C1", "", user);
		long c2 = createCard(deckId, "C2", "", user);
		long c3 = createCard(deckId, "C3", "", user);
		long c4 = createCard(deckId, "C4", "", user);
		long c5 = createCard(deckId, "C5", "", user);
		long c6 = createCard(deckId, "C6", "", user);
		long c7 = createCard(deckId, "C7", "", user);
		long c8 = createCard(deckId, "C8", "", user);
		long relearnOne = createCard(deckId, "R1", "", user);
		setRelearnState(relearnOne, -1, 2, userId);

		getJson("/api/decks/" + deckId + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(c1))
				.andExpect(jsonPath("$.cardIds[1]").value(c2))
				.andExpect(jsonPath("$.cardIds[2]").value(c3))
				.andExpect(jsonPath("$.cardIds[3]").value(c4))
				.andExpect(jsonPath("$.cardIds[4]").value(relearnOne))
				.andExpect(jsonPath("$.cardIds[5]").value(c5))
				.andExpect(jsonPath("$.cardIds[6]").value(c6))
				.andExpect(jsonPath("$.cardIds[7]").value(c7))
				.andExpect(jsonPath("$.cardIds[8]").value(c8));

		long tailDeck = createDeck("Tail", user);
		long tailOne = createCard(tailDeck, "T1", "", user);
		long tailTwo = createCard(tailDeck, "T2", "", user);
		long tailThree = createCard(tailDeck, "T3", "", user);
		long tailRelearn = createCard(tailDeck, "TR", "", user);
		setRelearnState(tailRelearn, -1, 3, userId);
		getJson("/api/decks/" + tailDeck + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(tailOne))
				.andExpect(jsonPath("$.cardIds[1]").value(tailTwo))
				.andExpect(jsonPath("$.cardIds[2]").value(tailThree))
				.andExpect(jsonPath("$.cardIds[3]").value(tailRelearn));

		long relearnTwo = createCard(deckId, "R2", "", user);
		setRelearnState(relearnTwo, -1, 2, userId);
		getJson("/api/decks/" + deckId + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(c1))
				.andExpect(jsonPath("$.cardIds[1]").value(c2))
				.andExpect(jsonPath("$.cardIds[2]").value(c3))
				.andExpect(jsonPath("$.cardIds[3]").value(c4))
				.andExpect(jsonPath("$.cardIds[4]").value(relearnOne))
				.andExpect(jsonPath("$.cardIds[5]").value(relearnTwo))
				.andExpect(jsonPath("$.cardIds[6]").value(c5))
				.andExpect(jsonPath("$.cardIds[7]").value(c6))
				.andExpect(jsonPath("$.cardIds[8]").value(c7))
				.andExpect(jsonPath("$.cardIds[9]").value(c8));
	}

	@Test
	void resetAndDeletedDeckKeepStatisticsHistory() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("History", user);
		long card = createCard(deckId, "Reset card", "", user);
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());

		postNoBody("/api/cards/" + card + "/reset", user).andExpect(status().isNoContent());
		JsonNode resetStats = jsonNode(getJson("/api/statistics?timezone=UTC", user).andReturn());
		assertEquals(1, resetStats.get("learnedToday").asLong());
		assertEquals(1, resetStats.get("resultCounts").get("FAMILIAR").asLong());
		assertEquals(1, resetStats.get("stageDistribution").get("-1").asLong());

		long deletedDeck = createDeck("Delete Me", user);
		long deletedCard = createCard(deletedDeck, "Deleted card", "", user);
		answerCard(deletedCard, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());
		deleteJson("/api/decks/" + deletedDeck, user).andExpect(status().isNoContent());

		JsonNode deletedStats = jsonNode(getJson("/api/statistics?timezone=UTC", user).andReturn());
		assertEquals(2, deletedStats.get("learnedToday").asLong());
		boolean found = false;
		for (JsonNode option : deletedStats.get("deckOptions")) {
			if ("Delete Me".equals(option.get("name").asText())) {
				found = option.get("deleted").asBoolean();
			}
		}
		assertTrue(found);
	}

	@Test
	void changingRefreshTimeKeepsHistoricalLearningDay() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("History Time", user);
		long card = createCard(deckId, "Event", "", user);
		answerCard(card, "FAMILIAR", "LEARN", "UTC", user).andExpect(status().isOk());

		Long userId = userIdFromCookie(user);
		List<AnswerEvent> before = answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId);
		LocalDate originalDay = before.get(before.size() - 1).getLearningDay();

		putJson("/api/settings", "{\"refreshTime\":\"23:00:00\",\"language\":\"EN\",\"theme\":\"DARK\"}",
				user).andExpect(status().isOk());

		List<AnswerEvent> after = answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId);
		assertEquals(originalDay, after.get(after.size() - 1).getLearningDay());
	}

	@Test
	void invalidQueueTypeReturnsBadRequest() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Invalid Queue", user);
		getJson("/api/decks/" + deckId + "/queue?type=BAD&timezone=UTC", user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("invalid_queue_type"));
	}

	@Test
	void expiredSessionsAreCleanedUp() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		UserSession expired = new UserSession("cleanup-" + System.nanoTime(), userId,
				Instant.now().minusSeconds(1), false);
		userSessionRepository.save(expired);

		sessionRegistryService.cleanupExpiredSessions();

		assertTrue(userSessionRepository.findById(expired.getSessionId()).isEmpty());
	}

	private void setRelearnState(Long cardId, int stage, int correctCount, Long userId) {
		var state = cardStateRepository.findActiveByCardIdForUser(cardId, userId).orElseThrow();
		state.setStage(stage);
		state.setQueueType(top.kariscode.karisanki.domain.CardQueue.RELEARN);
		state.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.BLURRY);
		state.setRelearnOrigin(top.kariscode.karisanki.domain.RelearnOrigin.LEARN);
		state.setRelearnCorrectCount(correctCount);
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);
	}

	private long stateVersion(long cardId, String cookie) throws Exception {
		return jsonNode(getJson("/api/cards/" + cardId, cookie).andReturn()).get("stateVersion").asLong();
	}

	private ResultActions answerCard(long cardId, String result, String queueType, String timezone,
			String cookie) throws Exception {
		long version = stateVersion(cardId, cookie);
		return postJson("/api/answer",
				"{\"clientAnswerId\":\"client-" + System.nanoTime() + "\",\"cardId\":" + cardId
						+ ",\"result\":\"" + result + "\",\"queueType\":\"" + queueType
						+ "\",\"timezone\":\"" + timezone + "\",\"stateVersion\":" + version + "}",
				cookie);
	}

	private void setReviewState(Long cardId, int stage, java.time.LocalDate dueDate, Long userId) {
		var state = cardStateRepository.findActiveByCardIdForUser(cardId, userId).orElseThrow();
		state.setStage(stage);
		state.setQueueType(top.kariscode.karisanki.domain.CardQueue.REVIEW);
		state.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.NONE);
		state.setRelearnOrigin(null);
		state.setRelearnCorrectCount(0);
		state.setDueDate(dueDate);
		state.setDueSince(null);
		cardStateRepository.save(state);
	}

	private String registerAndLogin() throws Exception {
		String email = uniqueEmail();
		MvcResult register = register(email, "password123", "testcode");
		assertStatus(register, 201);
		return sessionCookie(register);
	}

	private MvcResult register(String email, String password, String inviteCode) throws Exception {
		return postJson("/api/auth/register",
				"{\"email\":\"" + email + "\",\"password\":\"" + password + "\",\"inviteCode\":\"" + inviteCode
						+ "\",\"language\":\"ZH\"}",
				null).andReturn();
	}

	private MvcResult login(String email, String password, boolean rememberMe) throws Exception {
		return postJson("/api/auth/login",
				"{\"email\":\"" + email + "\",\"password\":\"" + password + "\",\"rememberMe\":" + rememberMe + "}",
				null).andReturn();
	}

	private long createDeck(String name, String cookie) throws Exception {
		return jsonLong(
				postJson("/api/decks", "{\"name\":\"" + name + "\"}", cookie).andExpect(status().isCreated())
						.andReturn(),
				"$.id");
	}

	private long createCard(long deckId, String front, String back, String cookie) throws Exception {
		String backJson = back == null ? "null" : "\"" + escapeJson(back) + "\"";
		return jsonLong(postJson("/api/decks/" + deckId + "/cards",
				"{\"front\":\"" + escapeJson(front) + "\",\"back\":" + backJson + "}", cookie)
				.andExpect(status().isCreated()).andReturn(), "$.id");
	}

	private ResultActions getJson(String path, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = get(path);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private ResultActions postJson(String path, String body, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = post(path).contentType(MediaType.APPLICATION_JSON).content(body);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private ResultActions putJson(String path, String body, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = put(path).contentType(MediaType.APPLICATION_JSON).content(body);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private ResultActions patchJson(String path, String body, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = patch(path).contentType(MediaType.APPLICATION_JSON).content(body);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private ResultActions postNoBody(String path, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = post(path);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private ResultActions deleteJson(String path, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = delete(path);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private void withCookie(MockHttpServletRequestBuilder request, String cookie) {
		if (cookie != null && !cookie.isBlank()) {
			String value = cookie.contains("=") ? cookie.split("=", 2)[1] : cookie;
			request.cookie(new Cookie("KARISANKI_SESSION", value));
		}
	}

	private ResultActions getMe(String cookie) throws Exception {
		return getJson("/api/auth/me", cookie);
	}

	private String sessionCookie(MvcResult result) {
		String value = result.getResponse().getHeader("Set-Cookie");
		if (value == null || value.isBlank()) {
			return "";
		}
		return value.split(";")[0];
	}

	private String sessionId(String cookie) {
		return cookie.contains("=") ? cookie.split("=", 2)[1] : cookie;
	}

	private long jsonLong(MvcResult result, String path) throws Exception {
		return jsonNode(result).get("id").asLong();
	}

	private JsonNode jsonNode(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private void assertStatus(MvcResult result, int status) throws Exception {
		if (result.getResponse().getStatus() != status) {
			throw new AssertionError("Expected " + status + " but got " + result.getResponse().getStatus()
					+ ": " + result.getResponse().getContentAsString());
		}
	}

	private String uniqueEmail() {
		return "user" + System.nanoTime() + "@example.com";
	}

	private String escapeJson(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"");
	}

	private long userIdFromCookie(String cookie) {
		return userSessionRepository.findAll().stream()
				.filter(session -> cookie.contains(session.getSessionId()))
				.findFirst()
				.map(UserSession::getUserId)
				.orElse(0L);
	}
}
