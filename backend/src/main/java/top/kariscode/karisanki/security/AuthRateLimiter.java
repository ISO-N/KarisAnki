package top.kariscode.karisanki.security;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import top.kariscode.karisanki.config.AppProperties;
import top.kariscode.karisanki.web.error.BusinessException;

@Component
public class AuthRateLimiter {

	private final AppProperties properties;
	private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

	public AuthRateLimiter(AppProperties properties) {
		this.properties = properties;
	}

	public void check(String key) {
		Deque<Instant> window = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
		synchronized (window) {
			Instant cutoff = Instant.now().minus(properties.getRateLimitWindow());
			while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
				window.removeFirst();
			}
			if (window.size() >= properties.getRateLimitMaxAttempts()) {
				throw BusinessException.rateLimited("尝试过于频繁，请稍后再试");
			}
			window.addLast(Instant.now());
		}
	}

	public void clear(String key) {
		attempts.remove(key);
	}
}
