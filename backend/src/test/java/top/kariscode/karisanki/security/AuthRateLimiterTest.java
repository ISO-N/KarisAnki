package top.kariscode.karisanki.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;

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
	@Test
	void cleanupExpiredRemovesOldAttempts() throws Exception {
		AppProperties properties = new AppProperties();
		properties.setRateLimitMaxAttempts(2);
		properties.setRateLimitWindow(Duration.ofMinutes(10));
		AuthRateLimiter limiter = new AuthRateLimiter(properties);

		Field field = AuthRateLimiter.class.getDeclaredField("attempts");
		field.setAccessible(true);
		@SuppressWarnings("unchecked")
		Map<String, Deque<Instant>> attempts = (Map<String, Deque<Instant>>) field.get(limiter);
		Deque<Instant> oldAttempts = new ArrayDeque<>();
		oldAttempts.add(Instant.now().minus(Duration.ofHours(2)));
		attempts.put("login:127.0.0.1:old@example.com", oldAttempts);

		limiter.cleanupExpired();

		assertTrue(attempts.isEmpty());
}
}
