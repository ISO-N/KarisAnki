package top.kariscode.karisanki;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.repository.CardRepository;

@SpringBootTest
@AutoConfigureMockMvc
class PronunciationIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private CardRepository cardRepository;

	@Test
	void createAndUpdateCardsPersistPhoneticForEnglishWordsOnly() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Pronunciation Create", user);

		long apple = createCard(deckId, "apple", "苹果", user);
		getJson("/api/cards/" + apple, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phonetic").value("ˈæpəl"));

		long chinese = createCard(deckId, "苹果", "apple", user);
		getJson("/api/cards/" + chinese, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phonetic").value(nullValue()));

		putJson("/api/cards/" + apple, "{\"front\":\"children\",\"back\":\"孩子们\"}", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phonetic").value("ˈtʃɪldrən"))
				.andExpect(jsonPath("$.stage").value(-1));
	}

	@Test
	void importCreatesPhoneticForRecognizedEnglishWords() throws Exception {
		String user = registerAndLogin();
		long deckId = createDeck("Pronunciation Import", user);

		String body = """
				{"rows":[
				  {"front":"apple","back":"苹果"},
				  {"front":"take up","back":"拿起"},
				  {"front":"苹果","back":"apple"}
				]}
				""";

		postJson("/api/decks/" + deckId + "/cards/import", body, user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.created").value(3));

		getJson("/api/decks/" + deckId + "/cards?page=0", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items", hasSize(3)))
				.andExpect(jsonPath("$.items[0].front").value("apple"))
				.andExpect(jsonPath("$.items[0].phonetic").value("ˈæpəl"))
				.andExpect(jsonPath("$.items[1].front").value("take up"))
				.andExpect(jsonPath("$.items[1].phonetic").value(nullValue()))
				.andExpect(jsonPath("$.items[2].front").value("苹果"))
				.andExpect(jsonPath("$.items[2].phonetic").value(nullValue()));
	}

	@Test
	void backfillUpdatesOnlyMissingEnglishWordPhoneticsAndReportsCounts() throws Exception {
		String user = registerAndLogin();
		String other = registerAndLogin();
		long deckId = createDeck("Pronunciation Backfill", user);

		long apple = createCard(deckId, "apple", "", user);
		long children = createCard(deckId, "children", "", user);
		long unknown = createCard(deckId, "zzzqx", "", user);
		long phrase = createCard(deckId, "take up", "", user);

		clearPhonetic(apple);
		clearPhonetic(unknown);
		clearPhonetic(phrase);

		postJson("/api/decks/" + deckId + "/cards/pronunciation/backfill", "{}", user)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.updated").value(1))
				.andExpect(jsonPath("$.unchanged").value(1))
				.andExpect(jsonPath("$.missing").value(1))
				.andExpect(jsonPath("$.notWord").value(1));

		getJson("/api/cards/" + apple, user).andExpect(jsonPath("$.phonetic").value("ˈæpəl"));
		getJson("/api/cards/" + unknown, user).andExpect(jsonPath("$.phonetic").value(nullValue()));
		getJson("/api/cards/" + phrase, user).andExpect(jsonPath("$.phonetic").value(nullValue()));

		postJson("/api/decks/" + deckId + "/cards/pronunciation/backfill", "{}", other)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("deck_not_found"));
	}

	private void clearPhonetic(long cardId) {
		Card card = cardRepository.findById(cardId).orElseThrow();
		card.setPhonetic(null);
		cardRepository.save(card);
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
		MvcResult result = postJson("/api/decks", "{\"name\":\"" + name + "\"}", cookie)
				.andExpect(status().isCreated()).andReturn();
		return jsonNode(result).get("id").asLong();
	}

	private long createCard(long deckId, String front, String back, String cookie) throws Exception {
		String backJson = back == null ? "null" : "\"" + escapeJson(back) + "\"";
		MvcResult result = postJson("/api/decks/" + deckId + "/cards",
				"{\"front\":\"" + escapeJson(front) + "\",\"back\":" + backJson + "}", cookie)
				.andExpect(status().isCreated()).andReturn();
		return jsonNode(result).get("id").asLong();
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

	private JsonNode jsonNode(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private String uniqueEmail() {
		return "pronunciation" + System.nanoTime() + "@example.com";
	}

	private String escapeJson(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"");
	}
}
