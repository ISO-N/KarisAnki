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
import java.time.LocalDate;
import java.time.ZoneOffset;
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

import top.kariscode.karisanki.domain.user.UserSession;
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

		postJson("/api/answer",
				"{\"cardId\":" + cardOne + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				userA).andExpect(status().isOk());

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

		postJson("/api/answer",
				"{\"cardId\":" + cardOne + ",\"result\":\"BLURRY\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk())
				.andExpect(jsonPath("$.queue[0]").value(cardTwo))
				.andExpect(jsonPath("$.queue[1]").value(cardOne))
				.andExpect(jsonPath("$.queue[2]").value(cardThree));

		postJson("/api/answer",
				"{\"cardId\":" + cardTwo + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

		getJson("/api/decks/" + deckId + "/queue?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cardIds[0]").value(cardThree))
				.andExpect(jsonPath("$.cardIds[1]").value(cardOne));

		long staleVersion = jsonNode(getJson("/api/cards/" + cardOne, user).andReturn()).get("stateVersion").asLong();
		postJson("/api/answer",
				"{\"cardId\":" + cardOne + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk())
				.andExpect(jsonPath("$.queue[0]").value(cardThree))
				.andExpect(jsonPath("$.queue[1]").value(cardOne));

		postJson("/api/answer",
				"{\"cardId\":" + cardOne + ",\"result\":\"BLURRY\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + staleVersion + "}",
				user).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("queue_refresh"));

		postNoBody("/api/cards/" + cardThree + "/reset", user).andExpect(status().isNoContent());
		postNoBody("/api/decks/" + deckId + "/reset?timezone=UTC", user).andExpect(status().isNoContent());

		long dueCard = createCard(deckId, "Due", "", user);
		postJson("/api/answer",
				"{\"cardId\":" + dueCard + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());
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

		postJson("/api/answer",
				"{\"cardId\":" + card + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

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
	void statisticsReportTomorrowRelearnRetentionAndForecast() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Stats", user);
		long learnedCard = createCard(deckId, "Learned", "", user);
		long relearnCard = createCard(deckId, "Relearn", "", user);

		postJson("/api/answer",
				"{\"cardId\":" + learnedCard + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

		postJson("/api/answer",
				"{\"cardId\":" + relearnCard + ",\"result\":\"BLURRY\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

		Long userId = userIdFromCookie(user);
		var state = cardStateRepository.findActiveByCardIdForUser(learnedCard, userId).orElseThrow();
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);

		getJson("/api/decks/" + deckId + "/queue?type=REVIEW&timezone=UTC", user).andExpect(status().isOk());

		long version = jsonNode(getJson("/api/cards/" + learnedCard, user).andReturn()).get("stateVersion").asLong();
		postJson("/api/answer",
				"{\"cardId\":" + learnedCard + ",\"result\":\"FAMILIAR\",\"queueType\":\"REVIEW\",\"timezone\":\"UTC\",\"stateVersion\":" + version + "}",
				user).andExpect(status().isOk());

		MvcResult statsResult = getJson("/api/statistics?timezone=UTC", user).andExpect(status().isOk()).andReturn();
		JsonNode stats = jsonNode(statsResult);
		assertTrue(stats.get("learnedToday").asLong() == 1);
		assertTrue(stats.get("reviewedToday").asLong() >= 1);
		assertTrue(stats.get("tomorrowDue").asLong() >= 1);
		assertTrue(stats.get("relearnCount").asLong() == 1);
		assertTrue(stats.get("retentionRate").asDouble() == 100.0);
		assertTrue(stats.get("resultCounts").get("FAMILIAR").asLong() == 2);
		assertTrue(stats.get("forecast").get("day7").asLong() > 0);
		assertTrue(stats.get("hourlyDistribution").size() == 24);
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
		postJson("/api/answer",
				"{\"cardId\":" + first + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());
		postJson("/api/answer",
				"{\"cardId\":" + second + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

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
		postJson("/api/answer",
				"{\"cardId\":" + learnedA + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());
		postJson("/api/answer",
				"{\"cardId\":" + relearnA + ",\"result\":\"BLURRY\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());
		postJson("/api/answer",
				"{\"cardId\":" + learnedB + ",\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

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
		postJson("/api/answer",
				"{\"cardId\":" + card + ",\"result\":\"BLURRY\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\"}",
				user).andExpect(status().isOk());

		long version = jsonNode(getJson("/api/cards/" + card, user).andReturn()).get("stateVersion").asLong();
		postJson("/api/answer",
				"{\"cardId\":" + card + ",\"result\":\"FORGOT\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + version + "}",
				user).andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("confirmation_required"));

		postJson("/api/answer",
				"{\"cardId\":" + card + ",\"result\":\"FORGOT\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + version + ",\"confirmForget\":true}",
				user).andExpect(status().isOk());
		getJson("/api/cards/" + card, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.relearnMode").value("FORGOT"));
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
