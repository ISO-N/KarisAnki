package top.kariscode.karisanki;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

@SpringBootTest
@AutoConfigureMockMvc
class CardImportIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void parseNormalizesRowsAndDetectsExistingDuplicates() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Import Parse", user);
		createCard(deckId, "Existing", "Answer", user);

		String source = """
				[
				  {"front":"  New Front  ","back":"  New Back  ","ignored":true},
				  {"front":"Existing","back":"Answer"},
				  {"front":"  ","back":"x"},
				  {"front":"One","back":null},
				  {"front":"Two"}
				]
				""";

		postJson(parsePath(deckId), parseBody(source), user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(5))
				.andExpect(jsonPath("$.validCount").value(3))
				.andExpect(jsonPath("$.duplicateCount").value(1))
				.andExpect(jsonPath("$.invalidCount").value(2))
				.andExpect(jsonPath("$.items[0].front").value("New Front"))
				.andExpect(jsonPath("$.items[0].back").value("New Back"))
				.andExpect(jsonPath("$.items[0].duplicate").value(false))
				.andExpect(jsonPath("$.items[1].front").value("Existing"))
				.andExpect(jsonPath("$.items[1].back").value("Answer"))
				.andExpect(jsonPath("$.items[1].duplicate").value(true))
				.andExpect(jsonPath("$.items[2].front").value(""))
				.andExpect(jsonPath("$.items[2].errors", hasSize(1)))
				.andExpect(jsonPath("$.items[2].errors[0]").value("front_required"))
				.andExpect(jsonPath("$.items[3].back").value(""))
				.andExpect(jsonPath("$.items[3].errors[0]").value("back_invalid"))
				.andExpect(jsonPath("$.items[4].back").value(""))
				.andExpect(jsonPath("$.items[4].errors", hasSize(0)));
	}

	@Test
	void parseRejectsInvalidJsonAndNonArrayRoots() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Import Invalid", user);

		postJson(parsePath(deckId), parseBody("not valid json"), user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("invalid_import_json"));

		postJson(parsePath(deckId), parseBody("{\"front\":\"a\"}"), user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("invalid_import_json"));
	}

	@Test
	void importCreatesCardsInOrderSkipsExistingAndInitializesNewState() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Import Cards", user);
		createCard(deckId, "Existing", "Existing back", user);

		String body = """
				{"rows":[
				  {"front":"  A  ","back":"  A back  "},
				  {"front":"Existing","back":"Existing back"},
				  {"front":"B","back":""},
				  {"front":"A","back":"A back"}
				]}
				""";

		postJson(importPath(deckId), body, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.created").value(3))
				.andExpect(jsonPath("$.skippedDuplicates").value(1));

		getJson("/api/decks/" + deckId + "/cards?page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(4))
				.andExpect(jsonPath("$.items[0].front").value("Existing"))
				.andExpect(jsonPath("$.items[1].front").value("A"))
				.andExpect(jsonPath("$.items[1].back").value("A back"))
				.andExpect(jsonPath("$.items[2].front").value("B"))
				.andExpect(jsonPath("$.items[2].back").value(""))
				.andExpect(jsonPath("$.items[3].front").value("A"))
				.andExpect(jsonPath("$.items[3].back").value("A back"))
				.andExpect(jsonPath("$.items[3].status").value("new"))
				.andExpect(jsonPath("$.items[3].stage").value(-1));
	}

	@Test
	void invalidImportRowRollsBackWholeBatch() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Import Atomic", user);

		String body = """
				{"rows":[
				  {"front":"Valid","back":""},
				  {"front":"   ","back":"must reject"}
				]}
				""";

		postJson(importPath(deckId), body, user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("front_required"));

		getJson("/api/decks/" + deckId + "/cards?page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(0));
	}

	@Test
	void parseAndImportAreIsolatedAcrossUsers() throws Exception {
		String owner = registerAndLogin();
		String other = registerAndLogin();
		long deckId = createDeck("Import Isolation", owner);

		postJson(parsePath(deckId), parseBody("[{\"front\":\"a\"}]"), other)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("deck_not_found"));

		postJson(importPath(deckId), "{\"rows\":[{\"front\":\"a\",\"back\":\"\"}]}", other)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("deck_not_found"));

		getJson("/api/decks/" + deckId + "/cards?page=0", other)
				.andExpect(status().isNotFound());
	}

	@Test
	void parseAndImportEnforceSourceSizeAndCardCountLimits() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Import Limits", user);

		String largeSource = "[" + "{\"front\":\"a\"},".repeat(600) + "{\"front\":\"a\"}]";
		postJson(parsePath(deckId), parseBody(largeSource), user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("import_source_too_large"));

		String overLimitSource = "[" + "{\"front\":\"a\"},".repeat(10) + "{\"front\":\"a\"}]";
		postJson(parsePath(deckId), parseBody(overLimitSource), user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("too_many_import_cards"));

		String overLimitRows = "{\"rows\":[" + "{\"front\":\"a\"},".repeat(10) + "{\"front\":\"a\"}]}";
		postJson(importPath(deckId), overLimitRows, user)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("too_many_import_cards"));
	}

	private String parsePath(long deckId) {
		return "/api/decks/" + deckId + "/cards/parse";
	}

	private String importPath(long deckId) {
		return "/api/decks/" + deckId + "/cards/import";
	}

	private String parseBody(String source) {
		return "{\"source\":\"" + escapeJson(source) + "\"}";
	}

	private String registerAndLogin() throws Exception {
		String email = uniqueEmail();
		MvcResult register = postJson("/api/auth/register",
				"{\"email\":\"" + email + "\",\"password\":\"password123\",\"inviteCode\":\"testcode\",\"language\":\"EN\"}",
				null).andReturn();
		if (register.getResponse().getStatus() != 201) {
			throw new AssertionError("Registration failed: " + register.getResponse().getContentAsString());
		}
		return sessionCookie(register);
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

	private ResultActions postJson(String path, String body, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = post(path).contentType(MediaType.APPLICATION_JSON).content(body);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private ResultActions getJson(String path, String cookie) throws Exception {
		MockHttpServletRequestBuilder request = get(path);
		withCookie(request, cookie);
		return mockMvc.perform(request);
	}

	private void withCookie(MockHttpServletRequestBuilder request, String cookie) {
		if (cookie != null && !cookie.isBlank()) {
			String value = cookie.contains("=") ? cookie.split("=", 2)[1] : cookie;
			request.cookie(new Cookie("KARISANKI_SESSION", value));
		}
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

	private String uniqueEmail() {
		return "import" + System.nanoTime() + "@example.com";
	}
	private String escapeJson(String value) {
		return value.replace("\\", "\\\\")
				.replace("\"", "\\\"")
				.replace("\r", "\\r")
				.replace("\n", "\\n")
				.replace("\t", "\\t");
	}
}
