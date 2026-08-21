package top.kariscode.karisanki;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.servlet.http.Cookie;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityBehaviorIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void invalidSessionReturnsUnauthorizedWithStableCode() throws Exception {
		mockMvc.perform(get("/api/auth/me").cookie(new Cookie("KARISANKI_SESSION", "missing-session")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("unauthenticated"));
	}
}
