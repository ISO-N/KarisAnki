package top.kariscode.karisanki;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneOffset;
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
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.UserSessionRepository;

@SpringBootTest
@AutoConfigureMockMvc
class OfflineSessionIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private AnswerEventRepository answerEventRepository;

	@Autowired
	private AnswerSubmissionRepository answerSubmissionRepository;

	@Autowired
	private CardStateRepository cardStateRepository;

	@Autowired
	private UserSessionRepository userSessionRepository;

	@Test
	void sessionSnapshotReturnsOrderedCardsAndFullCardContent() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Snapshot", user);
		long first = createCard(deckId, "First front", "First back", user);
		long second = createCard(deckId, "Second front", "Second back", user);

		getJson("/api/decks/" + deckId + "/session?type=LEARN&timezone=UTC", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.deckId").value(deckId))
				.andExpect(jsonPath("$.type").value("LEARN"))
				.andExpect(jsonPath("$.timezone").value("UTC"))
				.andExpect(jsonPath("$.total").value(2))
				.andExpect(jsonPath("$.order", hasSize(2)))
				.andExpect(jsonPath("$.order[0]").value(first))
				.andExpect(jsonPath("$.order[1]").value(second))
				.andExpect(jsonPath("$.cards", hasSize(2)))
				.andExpect(jsonPath("$.cards[0].id").value(first))
				.andExpect(jsonPath("$.cards[0].front").value("First front"))
				.andExpect(jsonPath("$.cards[0].back").value("First back"))
				.andExpect(jsonPath("$.cards[1].id").value(second))
				.andExpect(jsonPath("$.cards[1].stateVersion").isNumber());
	}

	@Test
	void idempotentReplayReturnsStoredResultWithoutSecondAnswerEvent() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		long deckId = createDeck("Replay", user);
		long first = createCard(deckId, "One", "", user);
		createCard(deckId, "Two", "", user);

		String clientAnswerId = "replay-" + System.nanoTime();
		long version = stateVersion(first, user);
		String body = answerBody(clientAnswerId, first, "FAMILIAR", "LEARN", "UTC", version, null, false, false);

		MvcResult firstResult = postJson("/api/answer", body, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accepted").value(true))
				.andReturn();
		JsonNode firstJson = objectMapper.readTree(firstResult.getResponse().getContentAsString());

		MvcResult secondResult = postJson("/api/answer", body, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accepted").value(true))
				.andReturn();
		JsonNode secondJson = objectMapper.readTree(secondResult.getResponse().getContentAsString());

		assertEquals(firstJson.get("clientAnswerId").asText(), secondJson.get("clientAnswerId").asText());
		assertEquals(firstJson.get("nextCardId").asLong(), secondJson.get("nextCardId").asLong());
		assertEquals(1, answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId).size());
		assertNotNull(answerSubmissionRepository.findByUserIdAndClientRequestId(userId, clientAnswerId).orElse(null));
	}

	@Test
	void staleStateVersionWithoutPreviousChainReturnsQueueRefresh() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Conflict", user);
		long card = createCard(deckId, "Card", "", user);

		long version = stateVersion(card, user);
		postJson("/api/answer", answerBody("accepted-" + System.nanoTime(), card, "FAMILIAR", "LEARN", "UTC",
				version, null, false, false), user).andExpect(status().isOk());

		postJson("/api/answer", answerBody("stale-" + System.nanoTime(), card, "BLURRY", "LEARN", "UTC",
				version, null, false, false), user).andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("queue_refresh"));
	}

	@Test
	void previousClientAnswerIdAllowsOfflineRelearnChainAcrossStateVersionChange() throws Exception {
		String user = registerAndLogin();
		Long userId = userIdFromCookie(user);
		long deckId = createDeck("Chain", user);
		long card = createCard(deckId, "Relearn", "", user);

		var state = cardStateRepository.findActiveByCardIdForUser(card, userId).orElseThrow();
		state.setStage(0);
		state.setQueueType(top.kariscode.karisanki.domain.CardQueue.RELEARN);
		state.setRelearnMode(top.kariscode.karisanki.domain.RelearnMode.BLURRY);
		state.setRelearnOrigin(top.kariscode.karisanki.domain.RelearnOrigin.LEARN);
		state.setRelearnCorrectCount(0);
		state.setDueDate(LocalDate.now(ZoneOffset.UTC));
		state.setDueSince(null);
		cardStateRepository.save(state);

		long originalVersion = stateVersion(card, user);
		String firstId = "chain-first-" + System.nanoTime();
		postJson("/api/answer", answerBody(firstId, card, "FAMILIAR", "LEARN", "UTC", originalVersion, null, false,
				false), user).andExpect(status().isOk()).andExpect(jsonPath("$.accepted").value(true));

		String secondId = "chain-second-" + System.nanoTime();
		postJson("/api/answer", answerBody(secondId, card, "FAMILIAR", "LEARN", "UTC",
				originalVersion, firstId, false, false), user).andExpect(status().isOk())
				.andExpect(jsonPath("$.accepted").value(true));

		assertEquals(2, answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId).size());
		var second = answerSubmissionRepository.findByUserIdAndClientRequestId(userId, secondId).orElseThrow();
		assertEquals(firstId, second.getPreviousClientRequestId());
	}


	private String answerBody(String clientAnswerId, long cardId, String result, String queueType, String timezone,
			long stateVersion, String previousClientAnswerId, boolean graduate, boolean confirmForget) {
		String previous = previousClientAnswerId == null ? "" : ",\"previousClientAnswerId\":\"" + previousClientAnswerId + "\"";
		return "{\"clientAnswerId\":\"" + clientAnswerId + "\",\"cardId\":" + cardId + ",\"result\":\"" + result
				+ "\",\"queueType\":\"" + queueType + "\",\"timezone\":\"" + timezone + "\",\"stateVersion\":"
				+ stateVersion + previous + ",\"graduate\":" + graduate + ",\"confirmForget\":" + confirmForget + "}";
	}

	private long stateVersion(long cardId, String cookie) throws Exception {
		return jsonNode(getJson("/api/cards/" + cardId, cookie).andReturn()).get("stateVersion").asLong();
	}

	private String registerAndLogin() throws Exception {
		String email = uniqueEmail();
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

	private Long userIdFromCookie(String cookie) {
		return userSessionRepository.findAll().stream()
				.filter(session -> cookie.contains(session.getSessionId()))
				.map(UserSession::getUserId)
				.findFirst()
				.orElse(0L);
	}

	private String uniqueEmail() {
		return "offline" + System.nanoTime() + "@example.com";
	}

	private String escapeJson(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"");
	}
}
