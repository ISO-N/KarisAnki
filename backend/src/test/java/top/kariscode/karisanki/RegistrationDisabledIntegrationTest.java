package top.kariscode.karisanki;

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

@SpringBootTest(properties = "karisanki.registration-enabled=false")
@AutoConfigureMockMvc
class RegistrationDisabledIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void registrationIsUnavailableWhenDisabled() throws Exception {
		mockMvc.perform(get("/api/auth/registration-status"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.enabled").value(false));

		mockMvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"disabled@example.com\",\"password\":\"password123\",\"inviteCode\":\"testcode\",\"rememberMe\":false,\"language\":\"EN\"}"))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("registration_unavailable"));
	}
}
