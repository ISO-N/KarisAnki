package top.kariscode.karisanki.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.springframework.stereotype.Service;

@Service
public class TimeService {

	public LocalDate learningDay(LocalTime refreshTime, String timezone, Instant now) {
		ZoneId zone = zone(timezone);
		ZonedDateTime zonedNow = now.atZone(zone);
		ZonedDateTime boundary = zonedNow.toLocalDate().atTime(refreshTime).atZone(zone);
		if (zonedNow.isBefore(boundary)) {
			return zonedNow.toLocalDate().minusDays(1);
		}
		return zonedNow.toLocalDate();
	}

	public LocalDate today(String timezone, Instant now) {
		return now.atZone(zone(timezone)).toLocalDate();
	}

	public ZoneId zone(String timezone) {
		try {
			return ZoneId.of(timezone);
		}
		catch (Exception ignored) {
			return ZoneId.systemDefault();
		}
	}
}
