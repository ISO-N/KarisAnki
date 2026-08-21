package top.kariscode.karisanki.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.StudyScene;
import top.kariscode.karisanki.domain.deck.AnswerEvent;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.deck.Deck;
import top.kariscode.karisanki.domain.scheduling.ScheduleEngine;
import top.kariscode.karisanki.domain.user.UserSettings;
import top.kariscode.karisanki.repository.AnswerEventRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.DeckRepository;
import top.kariscode.karisanki.web.dto.DeckOptionResponse;
import top.kariscode.karisanki.web.dto.StatisticsResponse;

@Service
public class StatisticsService {

	private final AuthService authService;
	private final AnswerEventRepository answerEventRepository;
	private final CardStateRepository cardStateRepository;
	private final DeckRepository deckRepository;
	private final DueStateService dueStateService;
	private final TimeService timeService;
	private final ScheduleEngine scheduleEngine;
	private final StatisticsCacheService statisticsCacheService;

	public StatisticsService(AuthService authService, AnswerEventRepository answerEventRepository,
			CardStateRepository cardStateRepository, DeckRepository deckRepository, DueStateService dueStateService,
			TimeService timeService, ScheduleEngine scheduleEngine, StatisticsCacheService statisticsCacheService) {
		this.authService = authService;
		this.answerEventRepository = answerEventRepository;
		this.cardStateRepository = cardStateRepository;
		this.deckRepository = deckRepository;
		this.dueStateService = dueStateService;
		this.timeService = timeService;
		this.scheduleEngine = scheduleEngine;
		this.statisticsCacheService = statisticsCacheService;
	}

	@Transactional
	public StatisticsResponse summary(Long userId, Long deckId, String timezone) {
		UserSettings settings = authService.settings(userId);
		Instant now = Instant.now();
		LocalDate learningDay = timeService.learningDay(settings.getRefreshTime(), timezone, now);
		LocalDate tomorrow = learningDay.plusDays(1);
		dueStateService.markDueStates(userId, learningDay, now);

		StatisticsResponse cached = statisticsCacheService.get(userId, deckId, timezone);
		if (cached != null) {
			return cached;
		}

		List<AnswerEvent> events = deckId == null
				? answerEventRepository.findByUserIdOrderByAnsweredAtAsc(userId)
				: answerEventRepository.findByUserIdAndDeckIdOrderByAnsweredAtAsc(userId, deckId);
		List<CardState> states = deckId == null
				? cardStateRepository.findActiveForUser(userId)
				: cardStateRepository.findActiveByDeckForUser(deckId, userId);

		long learnedToday = events.stream()
				.filter(event -> event.getLearningDay().equals(learningDay))
				.filter(event -> event.getStageBefore() == -1 && event.getStageAfter() == 0)
				.filter(event -> event.getScene() == StudyScene.LEARN || event.getScene() == StudyScene.RELEARN)
				.count();
		long reviewedToday = events.stream()
				.filter(event -> event.getLearningDay().equals(learningDay))
				.filter(event -> event.getScene() == StudyScene.REVIEW
						|| (event.getScene() == StudyScene.RELEARN && event.getQueueType() == StudyQueue.REVIEW))
				.count();
		long tomorrowDue = countTomorrowDue(states, tomorrow);
		long relearnCount = states.stream().filter(state -> state.getQueueType() == CardQueue.RELEARN).count();

		Map<String, Long> stageDistribution = new LinkedHashMap<>();
		for (int stage = -1; stage <= 9; stage++) {
			stageDistribution.put(String.valueOf(stage), 0L);
		}
		states.forEach(state -> stageDistribution.computeIfPresent(String.valueOf(state.getStage()),
				(key, value) -> value + 1));

		Map<String, Long> resultCounts = new LinkedHashMap<>();
		for (AnswerResult result : AnswerResult.values()) {
			resultCounts.put(result.name(), 0L);
		}
		events.forEach(event -> resultCounts.computeIfPresent(event.getResult().name(), (key, value) -> value + 1));

		Double retentionRate = calculateRetention(events);
		Map<String, Long> hourlyDistribution = hourlyDistribution(events, timezone);
		StatisticsResponse.ForecastResponse forecast = forecast(states, learningDay);
		List<DeckOptionResponse> deckOptions = deckRepository.findHistoryDecksForUser(userId).stream()
				.map(deck -> new DeckOptionResponse(deck.getId(), deck.getName(), deck.getDeletedAt() != null))
				.toList();

		StatisticsResponse response = new StatisticsResponse(learningDay, learnedToday, reviewedToday, tomorrowDue,
				relearnCount, stageDistribution, resultCounts, retentionRate, hourlyDistribution, forecast, deckOptions);
		statisticsCacheService.put(userId, deckId, timezone, response);
		return response;
	}

	private long countTomorrowDue(List<CardState> states, LocalDate tomorrow) {
		long count = 0;
		for (CardState state : states) {
			if (state.getStage() == 9 || state.getQueueType() == CardQueue.NEW) {
				continue;
			}
			if (state.getQueueType() == CardQueue.RELEARN) {
				LocalDate due = state.getDueDate();
				if (due == null || !due.isAfter(tomorrow)) {
					count++;
				}
				continue;
			}
			if (state.getDueDate() != null && state.getDueDate().equals(tomorrow)) {
				count++;
			}
		}
		return count;
	}

	private Double calculateRetention(List<AnswerEvent> events) {
		long total = events.stream().filter(event -> event.getScene() == StudyScene.REVIEW).count();
		if (total == 0) {
			return null;
		}
		long familiar = events.stream()
				.filter(event -> event.getScene() == StudyScene.REVIEW)
				.filter(event -> event.getResult() == AnswerResult.FAMILIAR)
				.count();
		return Math.round((familiar * 1000.0) / total) / 10.0;
	}

	private Map<String, Long> hourlyDistribution(List<AnswerEvent> events, String timezone) {
		Map<String, Long> buckets = new LinkedHashMap<>();
		for (int hour = 0; hour < 24; hour++) {
			buckets.put(String.valueOf(hour), 0L);
		}
		ZoneId zone = timeService.zone(timezone);
		events.forEach(event -> {
			ZonedDateTime zoned = event.getAnsweredAt().atZone(zone);
			buckets.computeIfPresent(String.valueOf(zoned.getHour()), (key, value) -> value + 1);
		});
		return buckets;
	}

	private StatisticsResponse.ForecastResponse forecast(List<CardState> states, LocalDate today) {
		return new StatisticsResponse.ForecastResponse(
				predict(states, today, 7),
				predict(states, today, 30),
				predict(states, today, 90),
				predict(states, today, 180));
	}

	private long predict(List<CardState> states, LocalDate today, int horizonDays) {
		LocalDate horizon = today.plusDays(horizonDays);
		long count = 0;
		for (CardState state : states) {
			if (state.getStage() == 9 || state.getQueueType() == CardQueue.NEW) {
				continue;
			}
			if (state.getQueueType() == CardQueue.RELEARN) {
				count++;
				continue;
			}
			if (state.getQueueType() != CardQueue.REVIEW || state.getStage() < 0 || state.getStage() > 8
					|| state.getDueDate() == null) {
				continue;
			}
			LocalDate next = state.getDueSince() != null || !state.getDueDate().isAfter(today) ? today
					: state.getDueDate();
			int stage = state.getStage();
			while (!next.isAfter(horizon)) {
				count++;
				if (stage >= 8) {
					next = next.plusDays(180);
				}
				else {
					stage++;
					next = next.plusDays(scheduleEngine.intervalDays(stage));
				}
			}
		}
		return count;
	}
}
