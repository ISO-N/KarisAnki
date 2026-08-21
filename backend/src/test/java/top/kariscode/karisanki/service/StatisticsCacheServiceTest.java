package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

import top.kariscode.karisanki.web.dto.StatisticsResponse;

class StatisticsCacheServiceTest {

	@Test
	void invalidateDeckAndUserClearStatisticsEntries() {
		StatisticsCacheService cache = new StatisticsCacheService();
		StatisticsResponse response = mock(StatisticsResponse.class);

		cache.put(1L, null, "UTC", response);
		cache.put(1L, 5L, "UTC", response);
		cache.put(2L, null, "UTC", response);

		assertNotNull(cache.get(1L, null, "UTC"));
		assertNotNull(cache.get(1L, 5L, "UTC"));

		cache.invalidateDeck(1L, 5L);

		assertNull(cache.get(1L, null, "UTC"));
		assertNull(cache.get(1L, 5L, "UTC"));
		assertNotNull(cache.get(2L, null, "UTC"));

		cache.invalidateUser(2L);
		assertNull(cache.get(2L, null, "UTC"));
	}
}
