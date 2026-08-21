package top.kariscode.karisanki;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import jakarta.servlet.http.Cookie;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import top.kariscode.karisanki.domain.user.UserSession;
import top.kariscode.karisanki.repository.AnswerEventRepository;
import top.kariscode.karisanki.repository.AnswerSubmissionRepository;
import top.kariscode.karisanki.repository.UserSessionRepository;

@SpringBootTest
@AutoConfigureMockMvc
class NetworkPerformanceIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private AnswerEventRepository answerEventRepository;

	@Autowired
	private AnswerSubmissionRepository answerSubmissionRepository;

	@Autowired
	private UserSessionRepository userSessionRepository;

	@Test
	void bootstrapAndOverviewReturnMergedDataWhileLegacyEndpointsRemainCompatible() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Merged", user);
		long first = createCard(deckId, "First", "", user);
		long second = createCard(deckId, "Second", "", user);

		getJson("/api/bootstrap?timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").isString())
				.andExpect(jsonPath("$.decks", hasSize(1)))
				.andExpect(jsonPath("$.decks[0].id").value(deckId))
				.andExpect(jsonPath("$.decks[0].newCount").value(2));

		getJson("/api/decks/" + deckId + "?timezone=UTC&page=0&q=&status=", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.deck.id").value(deckId))
				.andExpect(jsonPath("$.deck.newCount").value(2))
				.andExpect(jsonPath("$.cards.total").value(2))
				.andExpect(jsonPath("$.cards.items", hasSize(2)))
				.andExpect(jsonPath("$.cards.items[0].id").value(first))
				.andExpect(jsonPath("$.cards.items[1].id").value(second));

		getJson("/api/auth/me", user).andExpect(status().isOk());
		getJson("/api/decks?timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(deckId));
		getJson("/api/decks/" + deckId + "/cards?page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(2));

		String other = registerAndLogin();
		getJson("/api/decks/" + deckId + "?timezone=UTC", other).andExpect(status().isNotFound());
	}

	@Test
	void batchAnswerSupportsRelearnChainIdempotencyPartialConflictAndIsolation() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		long deckId = createDeck("Batch", user);
		long relearnCard = createCard(deckId, "Relearn", "", user);
		long acceptedCard = createCard(deckId, "Accepted", "", user);
		long staleCard = createCard(deckId, "Stale", "", user);

		long relearnVersion = stateVersion(relearnCard, user);
		long acceptedVersion = stateVersion(acceptedCard, user);
		long staleVersion = stateVersion(staleCard, user);

		String firstId = "batch-relearn-" + System.nanoTime();
		String chainId = "batch-chain-" + System.nanoTime();
		String acceptedId = "batch-accepted-" + System.nanoTime();
		String staleAcceptedId = "batch-stale-accepted-" + System.nanoTime();
		String staleId = "batch-stale-" + System.nanoTime();
		String body = batchBody(deckId, """
				[
				  {"clientAnswerId":"%s","cardId":%d,"result":"BLURRY","queueType":"LEARN","timezone":"UTC","stateVersion":%d},
				  {"clientAnswerId":"%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d,"previousClientAnswerId":"%s"},
				  {"clientAnswerId":"%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d},
				  {"clientAnswerId":"%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d},
				  {"clientAnswerId":"%s","cardId":%d,"result":"BLURRY","queueType":"LEARN","timezone":"UTC","stateVersion":%d}
				]
				""".formatted(firstId, relearnCard, relearnVersion, chainId, relearnCard, relearnVersion, firstId,
						acceptedId, acceptedCard, acceptedVersion, staleAcceptedId, staleCard, staleVersion, staleId,
						staleCard, staleVersion));
		postJson("/api/answer/batch", body, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results", hasSize(5)))
				.andExpect(jsonPath("$.results[0].clientAnswerId").value(firstId))
				.andExpect(jsonPath("$.results[0].accepted").value(true))
				.andExpect(jsonPath("$.results[1].clientAnswerId").value(chainId))
				.andExpect(jsonPath("$.results[1].accepted").value(true))
				.andExpect(jsonPath("$.results[2].clientAnswerId").value(acceptedId))
				.andExpect(jsonPath("$.results[2].accepted").value(true))
				.andExpect(jsonPath("$.results[3].clientAnswerId").value(staleAcceptedId))
				.andExpect(jsonPath("$.results[3].accepted").value(true))
				.andExpect(jsonPath("$.results[4].clientAnswerId").value(staleId))
				.andExpect(jsonPath("$.results[4].accepted").value(false))
				.andExpect(jsonPath("$.results[4].code").value("queue_refresh"));

		long eventsAfterFirst = answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId).size();
		assertEquals(4, eventsAfterFirst);

		postJson("/api/answer/batch", body, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results[0].accepted").value(true))
				.andExpect(jsonPath("$.results[1].accepted").value(true))
				.andExpect(jsonPath("$.results[2].accepted").value(true))
				.andExpect(jsonPath("$.results[3].accepted").value(true))
				.andExpect(jsonPath("$.results[4].accepted").value(false));
		assertEquals(eventsAfterFirst, answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId).size());
		assertTrue(answerSubmissionRepository.findByUserIdAndClientRequestId(userId, firstId).isPresent());

		String other = registerAndLogin();
		postJson("/api/answer/batch", body, other).andExpect(status().isNotFound());
	}

	@Test
	void batchQueueSimulationMatchesSequentialSingleAnswers() throws Exception {
		String user = registerAndLogin();
		long batchDeck = createDeck("Batch Queue", user);
		long singleDeck = createDeck("Single Queue", user);

		long b1 = createCard(batchDeck, "B1", "", user);
		long b2 = createCard(batchDeck, "B2", "", user);
		long b3 = createCard(batchDeck, "B3", "", user);
		long s1 = createCard(singleDeck, "S1", "", user);
		long s2 = createCard(singleDeck, "S2", "", user);
		long s3 = createCard(singleDeck, "S3", "", user);

		String batchBody = batchBody(batchDeck, """
				[
				  {"clientAnswerId":"d-b1-%s","cardId":%d,"result":"BLURRY","queueType":"LEARN","timezone":"UTC","stateVersion":%d},
				  {"clientAnswerId":"d-b2-%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d},
				  {"clientAnswerId":"d-b3-%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d}
				]
				""".formatted(System.nanoTime(), b1, stateVersion(b1, user), System.nanoTime(), b2,
						stateVersion(b2, user), System.nanoTime(), b3, stateVersion(b3, user)));

		JsonNode batch = jsonNode(postJson("/api/answer/batch", batchBody, user).andExpect(status().isOk()).andReturn());
		JsonNode firstSingle = jsonNode(apiAnswer(s1, "BLURRY", user).andExpect(status().isOk()).andReturn());
		JsonNode secondSingle = jsonNode(apiAnswer(s2, "FAMILIAR", user).andExpect(status().isOk()).andReturn());
		JsonNode thirdSingle = jsonNode(apiAnswer(s3, "FAMILIAR", user).andExpect(status().isOk()).andReturn());

		assertEquals(mapSingleToBatch(firstSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				batch.get("results").get(0).get("nextCardId").asLong());
		assertEquals(mapSingleToBatch(secondSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				batch.get("results").get(1).get("nextCardId").asLong());
		assertEquals(mapSingleToBatch(thirdSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				batch.get("results").get(2).get("nextCardId").asLong());
		assertEquals(firstSingle.get("completed").asBoolean(), batch.get("results").get(0).get("completed").asBoolean());
		assertEquals(secondSingle.get("completed").asBoolean(), batch.get("results").get(1).get("completed").asBoolean());
		assertEquals(thirdSingle.get("completed").asBoolean(), batch.get("results").get(2).get("completed").asBoolean());

		JsonNode batchQueue = jsonNode(getJson("/api/decks/" + batchDeck + "/queue?type=LEARN&timezone=UTC", user).andReturn());
		JsonNode singleQueue = jsonNode(getJson("/api/decks/" + singleDeck + "/queue?type=LEARN&timezone=UTC", user).andReturn());
		assertEquals(batchQueue.get("cardIds").size(), singleQueue.get("cardIds").size());
		for (int index = 0; index < batchQueue.get("cardIds").size(); index++) {
			long mapped = mapSingleToBatch(singleQueue.get("cardIds").get(index).asLong(), b1, b2, b3, s1, s2, s3);
			assertEquals(mapped, batchQueue.get("cardIds").get(index).asLong());
		}
	}

	@Test
	void batchRelearnQueueSimulationMatchesSequentialAnswersForSameCard() throws Exception {
		String user = registerAndLogin();
		long batchDeck = createDeck("Batch Same Relearn", user);
		long singleDeck = createDeck("Single Same Relearn", user);
		long b1 = createCard(batchDeck, "B1", "", user);
		long b2 = createCard(batchDeck, "B2", "", user);
		long b3 = createCard(batchDeck, "B3", "", user);
		long b4 = createCard(batchDeck, "B4", "", user);
		long b5 = createCard(batchDeck, "B5", "", user);
		long s1 = createCard(singleDeck, "S1", "", user);
		long s2 = createCard(singleDeck, "S2", "", user);
		long s3 = createCard(singleDeck, "S3", "", user);
		long s4 = createCard(singleDeck, "S4", "", user);
		long s5 = createCard(singleDeck, "S5", "", user);
		long batchRelearn = createCard(batchDeck, "BR", "", user);
		long singleRelearn = createCard(singleDeck, "SR", "", user);

		long version = stateVersion(batchRelearn, user);
		String id1 = "same-b1-" + System.nanoTime();
		String id2 = "same-b2-" + System.nanoTime();
		String id3 = "same-b3-" + System.nanoTime();
		String id4 = "same-b4-" + System.nanoTime();

		String firstBody = batchBody(batchDeck, """
				[
				  {"clientAnswerId":"%s","cardId":%d,"result":"BLURRY","queueType":"LEARN","timezone":"UTC","stateVersion":%d},
				  {"clientAnswerId":"%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d,"previousClientAnswerId":"%s"},
				  {"clientAnswerId":"%s","cardId":%d,"result":"FAMILIAR","queueType":"LEARN","timezone":"UTC","stateVersion":%d,"previousClientAnswerId":"%s"}
				]
				""".formatted(id1, batchRelearn, version, id2, batchRelearn, version, id1, id3, batchRelearn, version, id2));

		JsonNode firstBatch = jsonNode(postJson("/api/answer/batch", firstBody, user)
				.andExpect(status().isOk()).andReturn());
		JsonNode firstSingle = jsonNode(apiAnswer(singleRelearn, "BLURRY", user).andExpect(status().isOk()).andReturn());
		JsonNode secondSingle = jsonNode(apiAnswer(singleRelearn, "FAMILIAR", user).andExpect(status().isOk()).andReturn());
		JsonNode thirdSingle = jsonNode(apiAnswer(singleRelearn, "FAMILIAR", user).andExpect(status().isOk()).andReturn());
		assertEquals(mapSingleToBatch(firstSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				firstBatch.get("results").get(0).get("nextCardId").asLong());
		assertEquals(mapSingleToBatch(secondSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				firstBatch.get("results").get(1).get("nextCardId").asLong());
		assertEquals(mapSingleToBatch(thirdSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				firstBatch.get("results").get(2).get("nextCardId").asLong());

		JsonNode batchQueueAfterThree = jsonNode(getJson("/api/decks/" + batchDeck + "/queue?type=LEARN&timezone=UTC", user).andReturn());
		JsonNode singleQueueAfterThree = jsonNode(getJson("/api/decks/" + singleDeck + "/queue?type=LEARN&timezone=UTC", user).andReturn());
		assertEquals(batchRelearn, batchQueueAfterThree.get("cardIds").get(4).asLong());
		assertEquals(singleRelearn, singleQueueAfterThree.get("cardIds").get(4).asLong());

		String secondBody = batchBody(batchDeck, """
				[
				  {"clientAnswerId":"%s","cardId":%d,"result":"BLURRY","queueType":"LEARN","timezone":"UTC","stateVersion":%d,"previousClientAnswerId":"%s"}
				]
				""".formatted(id4, batchRelearn, version, id3));
		JsonNode secondBatch = jsonNode(postJson("/api/answer/batch", secondBody, user)
				.andExpect(status().isOk()).andReturn());
		JsonNode fourthSingle = jsonNode(apiAnswer(singleRelearn, "BLURRY", user).andExpect(status().isOk()).andReturn());
		assertEquals(mapSingleToBatch(fourthSingle.get("nextCardId").asLong(), b1, b2, b3, s1, s2, s3),
				secondBatch.get("results").get(0).get("nextCardId").asLong());

		JsonNode batchFinal = jsonNode(getJson("/api/decks/" + batchDeck + "/queue?type=LEARN&timezone=UTC", user).andReturn());
		JsonNode singleFinal = jsonNode(getJson("/api/decks/" + singleDeck + "/queue?type=LEARN&timezone=UTC", user).andReturn());
		assertEquals(batchRelearn, batchFinal.get("cardIds").get(1).asLong());
		assertEquals(singleRelearn, singleFinal.get("cardIds").get(1).asLong());
	}

	@Test
	void batchRejectsMoreThanFiftyItemsWithExplicitError() throws Exception {
		String user = registerAndLogin();
		StringBuilder items = new StringBuilder("[");
		for (int index = 0; index < 51; index++) {
			if (index > 0) items.append(",");
			items.append("{\"clientAnswerId\":\"x-%d-%d\",\"cardId\":1,\"result\":\"FAMILIAR\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":0}"
					.formatted(System.nanoTime(), index));
		}
		items.append("]");
		postJson("/api/answer/batch", batchBody(1, items.toString()), user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("batch_too_large"));
	}

	private ResultActions apiAnswer(long cardId, String result, String cookie) throws Exception {
		long version = stateVersion(cardId, cookie);
		String id = "single-" + cardId + "-" + System.nanoTime();
		return postJson("/api/answer",
				"{\"clientAnswerId\":\"" + id + "\",\"cardId\":" + cardId + ",\"result\":\"" + result
						+ "\",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"stateVersion\":" + version + "}",
				cookie);
	}

	private long mapSingleToBatch(long singleCardId, long b1, long b2, long b3, long s1, long s2, long s3) {
		if (singleCardId == s1) return b1;
		if (singleCardId == s2) return b2;
		if (singleCardId == s3) return b3;
		return -1L;
	}

	private String batchBody(long deckId, String items) {
		return "{\"deckId\":" + deckId + ",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"items\":" + items + "}";
	}

	private String registerAndLogin() throws Exception {
		String email = "network" + System.nanoTime() + "@example.com";
		MvcResult result = postJson("/api/auth/register",
				"{\"email\":\"" + email + "\",\"password\":\"password123\",\"inviteCode\":\"testcode\",\"language\":\"EN\"}",
				null).andReturn();
		if (result.getResponse().getStatus() != 201) {
			throw new AssertionError("Registration failed: " + result.getResponse().getContentAsString());
		}
		return sessionCookie(result);
	}

	private long createDeck(String name, String cookie) throws Exception {
		return jsonLong(postJson("/api/decks", "{\"name\":\"" + name + "\"}", cookie)
				.andExpect(status().isCreated()).andReturn(), "$.id");
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

	private void withCookie(MockHttpServletRequestBuilder request, String cookie) {
		if (cookie == null || cookie.isBlank()) {
			return;
		}
		String value = cookie.contains("=") ? cookie.split("=", 2)[1] : cookie;
		request.cookie(new Cookie("KARISANKI_SESSION", value));
	}

	private String sessionCookie(MvcResult result) {
		String value = result.getResponse().getHeader("Set-Cookie");
		if (value == null || value.isBlank()) {
			return "";
		}
		return value.split(";")[0];
	}

	private long jsonLong(MvcResult result, String path) throws Exception {
		return jsonNode(result).get("id").asLong();
	}

	private JsonNode jsonNode(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private long stateVersion(long cardId, String cookie) throws Exception {
		return jsonNode(getJson("/api/cards/" + cardId, cookie).andReturn()).get("stateVersion").asLong();
	}

	private Long userIdFromCookie(String cookie) {
		return userSessionRepository.findAll().stream()
				.filter(session -> cookie.contains(session.getSessionId()))
				.findFirst()
				.map(UserSession::getUserId)
				.orElse(0L);
	}

	private String uniqueEmail() {
		return "network" + System.nanoTime() + "@example.com";
	}

	private String escapeJson(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"");
	}
}
