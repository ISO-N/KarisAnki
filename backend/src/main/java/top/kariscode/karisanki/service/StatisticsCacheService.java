package top.kariscode.karisanki.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import top.kariscode.karisanki.web.dto.StatisticsResponse;

@Service
public class StatisticsCacheService {

	private static final long TTL_MILLIS = 30_000L;

	private final Map<String, CacheEntry> entries = new ConcurrentHashMap<>();

	public StatisticsResponse get(Long userId, Long deckId, String timezone) {
		String key = key(userId, deckId, timezone);
		CacheEntry entry = entries.get(key);
		if (entry == null) {
			return null;
		}
		if (System.currentTimeMillis() - entry.createdAtMillis() >= TTL_MILLIS) {
			entries.remove(key, entry);
			return null;
		}
		return entry.response();
	}

	public void put(Long userId, Long deckId, String timezone, StatisticsResponse response) {
		String key = key(userId, deckId, timezone);
		entries.put(key, new CacheEntry(response, System.currentTimeMillis()));
	}

	public void invalidateDeck(Long userId, Long deckId) {
		invalidateUser(userId);
	}

	public void invalidateUser(Long userId) {
		String prefix = userId + ":";
		entries.keySet().removeIf(key -> key.startsWith(prefix));
	}

	private String key(Long userId, Long deckId, String timezone) {
		return userId + ":" + (deckId == null ? "all" : deckId) + ":" + (timezone == null ? "UTC" : timezone);
	}

	private record CacheEntry(StatisticsResponse response, long createdAtMillis) {
	}
}
