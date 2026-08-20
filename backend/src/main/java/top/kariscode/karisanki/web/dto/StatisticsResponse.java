package top.kariscode.karisanki.web.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record StatisticsResponse(
		LocalDate learningDay,
		long learnedToday,
		long reviewedToday,
		long tomorrowDue,
		long relearnCount,
		Map<String, Long> stageDistribution,
		Map<String, Long> resultCounts,
		Double retentionRate,
		Map<String, Long> hourlyDistribution,
		ForecastResponse forecast,
		List<DeckOptionResponse> deckOptions) {

	public record ForecastResponse(long day7, long day30, long day90, long day180) {
	}
}
