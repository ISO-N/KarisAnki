package top.kariscode.karisanki;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.yaml.snakeyaml.Yaml;

import jakarta.servlet.http.Cookie;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class ApiContractIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void realResponsesConformToSharedOpenApiContract() throws Exception {
		String email = "contract-" + System.nanoTime() + "@example.com";
		MvcResult registered = mockMvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"password\":\"password123\",\"inviteCode\":\"testcode\",\"rememberMe\":false,\"language\":\"EN\"}"))
				.andExpect(status().isCreated())
				.andReturn();
		String sessionCookie = cookie(registered);
		JsonNode user = json(registered);
		assertSchema(user, "User");

		JsonNode status = json(getRequest("/api/auth/registration-status"));
		assertSchema(status, "RegistrationStatus");

		JsonNode me = json(getRequest("/api/auth/me", sessionCookie));
		assertSchema(me, "User");

		JsonNode deck = json(postRequest("/api/decks", "{\"name\":\"Contract Deck\"}", sessionCookie));
		assertSchema(deck, "Deck");
		long deckId = deck.get("id").asLong();

		JsonNode decks = json(getRequest("/api/decks?timezone=UTC", sessionCookie));
		assertTrue(decks.isArray());
		assertSchema(decks.get(0), "Deck");

		JsonNode card = json(postRequest("/api/decks/" + deckId + "/cards",
				"{\"front\":\"Contract front\",\"back\":\"Contract back\"}", sessionCookie));
		assertSchema(card, "Card");
		long cardId = card.get("id").asLong();

		JsonNode cards = json(getRequest("/api/decks/" + deckId + "/cards?page=0", sessionCookie));
		assertSchema(cards, "CardList");

		JsonNode overview = json(getRequest("/api/decks/" + deckId + "?timezone=UTC&page=0", sessionCookie));
		assertSchema(overview, "DeckOverview");

		JsonNode session = json(getRequest("/api/decks/" + deckId + "/session?type=LEARN&timezone=UTC", sessionCookie));
		assertSchema(session, "Session");

		JsonNode settings = json(getRequest("/api/settings", sessionCookie));
		assertSchema(settings, "Settings");

		JsonNode updatedSettings = json(putRequest("/api/settings",
				"{\"refreshTime\":\"06:00:00\",\"language\":\"ZH\",\"theme\":\"DARK\"}", sessionCookie));
		assertSchema(updatedSettings, "Settings");

		String batch = "{\"deckId\":" + deckId + ",\"queueType\":\"LEARN\",\"timezone\":\"UTC\",\"items\":["
				+ "{\"clientAnswerId\":\"contract-answer\",\"cardId\":" + cardId
				+ ",\"result\":\"FAMILIAR\",\"stateVersion\":" + card.get("stateVersion").asLong()
				+ ",\"graduate\":false,\"confirmForget\":false}]}";
		JsonNode batchResponse = json(postRequest("/api/answer/batch", batch, sessionCookie));
		assertSchema(batchResponse, "AnswerBatchResponse");
		assertEquals(true, batchResponse.get("results").get(0).get("accepted").asBoolean());

		JsonNode stats = json(getRequest("/api/statistics?timezone=UTC", sessionCookie));
		assertSchema(stats, "Statistics");
	}

	private JsonNode json(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private MvcResult getRequest(String path, String sessionCookie) throws Exception {
		return mockMvc.perform(get(path).cookie(cookie(sessionCookie)))
				.andExpect(status().isOk())
				.andReturn();
	}

	private MvcResult getRequest(String path) throws Exception {
		return mockMvc.perform(get(path)).andExpect(status().isOk()).andReturn();
	}

	private MvcResult postRequest(String path, String body, String sessionCookie) throws Exception {
		return mockMvc.perform(post(path).cookie(cookie(sessionCookie))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().is2xxSuccessful())
				.andReturn();
	}

	private MvcResult putRequest(String path, String body, String sessionCookie) throws Exception {
		return mockMvc.perform(put(path).cookie(cookie(sessionCookie))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isOk())
				.andReturn();
	}

	private Cookie cookie(String value) {
		return new Cookie("KARISANKI_SESSION", value);
	}

	private String cookie(MvcResult result) {
		for (Cookie cookie : result.getResponse().getCookies()) {
			if (cookie.getName().equals("KARISANKI_SESSION")) {
				return cookie.getValue();
			}
		}
		return result.getResponse().getHeader("Set-Cookie").split(";")[0].split("=", 2)[1];
	}

	@SuppressWarnings("unchecked")
	private void assertSchema(JsonNode body, String schemaName) throws Exception {
		Map<String, Object> root = new Yaml().load(Files.readString(Path.of("..", "contracts", "openapi.yaml")));
		Map<String, Object> components = (Map<String, Object>) root.get("components");
		Map<String, Object> schemas = (Map<String, Object>) components.get("schemas");
		Map<String, Object> schema = (Map<String, Object>) schemas.get(schemaName);
		List<String> required = (List<String>) schema.get("required");
		for (String field : required) {
			assertTrue(body.has(field), schemaName + " is missing required field " + field);
		}
	}
}
