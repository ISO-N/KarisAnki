package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

class TimeServiceTest {

	private final TimeService timeService = new TimeService();

	@Test
	void learningDayUsesRefreshTimeBoundary() {
		Instant beforeBoundary = Instant.parse("2026-08-21T03:00:00Z");
		Instant afterBoundary = Instant.parse("2026-08-21T05:00:00Z");

		assertEquals(LocalDate.of(2026, 8, 20),
				timeService.learningDay(LocalTime.of(4, 0), "UTC", beforeBoundary));
		assertEquals(LocalDate.of(2026, 8, 21),
				timeService.learningDay(LocalTime.of(4, 0), "UTC", afterBoundary));
	}

	@Test
	void learningDayUsesTimezoneForSameInstant() {
		Instant now = Instant.parse("2026-08-21T03:00:00Z");
		assertEquals(LocalDate.of(2026, 8, 21),
				timeService.learningDay(LocalTime.of(4, 0), "Pacific/Kiritimati", now));
		assertEquals(LocalDate.of(2026, 8, 20),
				timeService.learningDay(LocalTime.of(4, 0), "Pacific/Midway", now));
	}

	@Test
	void changingRefreshTimeReinterpretsSameInstant() {
		Instant now = Instant.parse("2026-08-21T20:00:00Z");
		assertEquals(LocalDate.of(2026, 8, 21),
				timeService.learningDay(LocalTime.of(4, 0), "UTC", now));
		assertEquals(LocalDate.of(2026, 8, 20),
				timeService.learningDay(LocalTime.of(23, 0), "UTC", now));
	}

	@Test
	void invalidTimezoneFallsBackToSystemZoneWithoutThrowing() {
		Instant now = Instant.parse("2026-08-21T12:00:00Z");
		assertEquals(timeService.learningDay(LocalTime.of(4, 0), ZoneId.systemDefault().getId(), now),
				timeService.learningDay(LocalTime.of(4, 0), "not-a-timezone", now));
	}
}
