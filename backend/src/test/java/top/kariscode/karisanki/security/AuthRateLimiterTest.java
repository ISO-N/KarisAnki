package top.kariscode.karisanki.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;

import org.junit.jupiter.api.Test;

import top.kariscode.karisanki.config.AppProperties;
import top.kariscode.karisanki.web.error.BusinessException;

class AuthRateLimiterTest {

	@Test
	void blocksAfterConfiguredAttemptsAndClears() {
		AppProperties properties = new AppProperties();
		properties.setRateLimitMaxAttempts(2);
		properties.setRateLimitWindow(Duration.ofMinutes(10));

		AuthRateLimiter limiter = new AuthRateLimiter(properties);
		limiter.check("login:127.0.0.1:user@example.com");
		limiter.check("login:127.0.0.1:user@example.com");

		BusinessException exception = assertThrows(BusinessException.class,
				() -> limiter.check("login:127.0.0.1:user@example.com"));
		assertEquals("rate_limited", exception.getCode());

		limiter.clear("login:127.0.0.1:user@example.com");
		assertDoesNotThrow(() -> limiter.check("login:127.0.0.1:user@example.com"));
	}
}
