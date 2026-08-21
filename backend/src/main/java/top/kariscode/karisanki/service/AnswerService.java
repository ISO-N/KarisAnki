package top.kariscode.karisanki.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.deck.AnswerEvent;
import top.kariscode.karisanki.domain.deck.AnswerSubmission;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.scheduling.ConfirmationRequiredException;
import top.kariscode.karisanki.domain.scheduling.ScheduleEngine;
import top.kariscode.karisanki.domain.scheduling.ScheduleResult;
import top.kariscode.karisanki.domain.scheduling.ScheduleState;
import top.kariscode.karisanki.domain.scheduling.SchedulingConflictException;
import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSettings;
import top.kariscode.karisanki.repository.AnswerEventRepository;
import top.kariscode.karisanki.repository.AnswerSubmissionRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.UserRepository;
import top.kariscode.karisanki.web.dto.AnswerBatchDtos;
import top.kariscode.karisanki.web.dto.AnswerRequest;
import top.kariscode.karisanki.web.dto.AnswerResponse;
import top.kariscode.karisanki.web.error.BusinessException;

@Service
public class AnswerService {

	public static final int MAX_BATCH_SIZE = 50;

	private static final String CODE_ACCEPTED = "accepted";
	private static final String CODE_QUEUE_REFRESH = "queue_refresh";
	private static final String CODE_CONFIRMATION_REQUIRED = "confirmation_required";
	private static final String CODE_VALIDATION_ERROR = "validation_error";
	private static final String CODE_CARD_NOT_FOUND = "card_not_found";

	private final CardService cardService;
	private final AuthService authService;
	private final CardStateRepository cardStateRepository;
	private final AnswerEventRepository answerEventRepository;
	private final AnswerSubmissionRepository answerSubmissionRepository;
	private final UserRepository userRepository;
	private final QueueService queueService;
	private final QueueSimulationService queueSimulationService;
	private final TimeService timeService;
	private final ScheduleEngine scheduleEngine;
	private final StatisticsCacheService statisticsCacheService;

	public AnswerService(CardService cardService, AuthService authService,
			CardStateRepository cardStateRepository, AnswerEventRepository answerEventRepository,
			AnswerSubmissionRepository answerSubmissionRepository, UserRepository userRepository, QueueService queueService,
			QueueSimulationService queueSimulationService, TimeService timeService, ScheduleEngine scheduleEngine,
			StatisticsCacheService statisticsCacheService) {
		this.cardService = cardService;
		this.authService = authService;
		this.cardStateRepository = cardStateRepository;
		this.answerEventRepository = answerEventRepository;
		this.answerSubmissionRepository = answerSubmissionRepository;
		this.userRepository = userRepository;
		this.queueService = queueService;
		this.queueSimulationService = queueSimulationService;
		this.timeService = timeService;
		this.scheduleEngine = scheduleEngine;
		this.statisticsCacheService = statisticsCacheService;
	}

	@Transactional
	public AnswerResponse answer(Long userId, AnswerRequest request) {
		AnswerSubmission existing = answerSubmissionRepository.findByUserIdAndClientRequestId(userId,
				request.clientAnswerId()).orElse(null);
		if (existing != null) {
			return toResponse(existing);
		}

		Card card = cardService.requireCard(userId, request.cardId());
		UserSettings settings = authService.settings(userId);
		CardState state = card.getState();
		if (state == null) {
			throw BusinessException.notFound("card_not_found", "卡片不存在");
		}
		if (!request.stateVersion().equals(state.getVersion())
				&& !hasAcceptedPreviousChain(userId, request, card.getId())) {
			throw BusinessException.conflict("queue_refresh", "卡片状态已变化，请刷新队列");
		}

		User user = userRepository.findById(userId)
				.orElseThrow(() -> BusinessException.unauthorized("unauthenticated", "登录状态已失效"));

		String timezone = request.timezone();
		Instant now = Instant.now();
		java.time.LocalDate learningDay = timeService.learningDay(settings.getRefreshTime(), timezone, now);

		ScheduleState scheduleState = fromEntity(state);
		ScheduleResult result = scheduleEngine.answer(scheduleState, request.queueType(), request.result(),
				learningDay, now, Boolean.TRUE.equals(request.graduate()),
				Boolean.TRUE.equals(request.confirmForget()));

		applyToEntity(state, result.state());
		cardStateRepository.saveAndFlush(state);
		AnswerEvent event = answerEventRepository.saveAndFlush(new AnswerEvent(user, card.getDeck(), card, now, timezone,
				learningDay, result.scene(), result.stageBefore(), result.stageAfter(), request.result()));

		StudyQueue queueType = request.queueType();
		QueueService.QueueSnapshot snapshot = queueService.sessionQueue(userId, card.getDeck().getId(), queueType,
				timezone);
		Long nextCardId = snapshot.order().isEmpty() ? null : snapshot.order().get(0);
		boolean completed = snapshot.order().isEmpty();
		answerSubmissionRepository.saveAndFlush(new AnswerSubmission(user, request.clientAnswerId(), card, request.result(),
				queueType, timezone, request.stateVersion(), request.previousClientAnswerId(),
				Boolean.TRUE.equals(request.graduate()), Boolean.TRUE.equals(request.confirmForget()), completed,
				nextCardId, event, now));

		statisticsCacheService.invalidateDeck(userId, card.getDeck().getId());
		return new AnswerResponse(card.getId(), request.clientAnswerId(), true, nextCardId, completed, false);
	}

	@Transactional
	public AnswerBatchDtos.AnswerBatchResponse answerBatch(Long userId, AnswerBatchDtos.AnswerBatchRequest request) {
		if (request.items().size() > MAX_BATCH_SIZE) {
			throw BusinessException.badRequest("batch_too_large",
					"单批最多提交 " + MAX_BATCH_SIZE + " 条评分");
		}

		User user = userRepository.findById(userId)
				.orElseThrow(() -> BusinessException.unauthorized("unauthenticated", "登录状态已失效"));
		UserSettings settings = authService.settings(userId);

		Map<String, AnswerBatchDtos.AnswerItemResponse> acceptedByClientId = new HashMap<>();
		List<AnswerBatchDtos.AnswerItemResponse> results = new ArrayList<>(request.items().size());
		boolean hasNewItem = false;

		for (AnswerBatchDtos.AnswerItemRequest item : request.items()) {
			AnswerBatchDtos.AnswerItemResponse accepted = acceptedByClientId.get(item.clientAnswerId());
			if (accepted == null) {
				AnswerSubmission existing = answerSubmissionRepository.findByUserIdAndClientRequestId(userId,
						item.clientAnswerId()).orElse(null);
				if (existing != null) {
					accepted = toBatchResponse(existing);
				}
			}
			if (accepted != null) {
				results.add(accepted);
				continue;
			}
			hasNewItem = true;
			results.add(null);
		}

		QueueService.QueueSnapshot snapshot = null;
		QueueSimulationService.MutableQueue queue = null;
		if (hasNewItem) {
			snapshot = queueService.sessionQueue(userId, request.deckId(), request.queueType(), request.timezone());
			queue = queueSimulationService.create(snapshot);
		}

		Instant batchNow = Instant.now();
		for (int index = 0; index < request.items().size(); index++) {
			if (results.get(index) != null) {
				continue;
			}
			AnswerBatchDtos.AnswerItemRequest item = request.items().get(index);
			Card card;
			try {
				card = cardService.requireCard(userId, item.cardId());
			}
			catch (BusinessException exception) {
				results.set(index, batchItem(item, null, false, exception.getCode(), null, false, false));
				continue;
			}
			if (!card.getDeck().getId().equals(request.deckId())) {
				results.set(index, batchItem(item, card.getId(), false, CODE_VALIDATION_ERROR, null, false, false));
				continue;
			}

			CardState state = card.getState();
			if (state == null) {
				results.set(index, batchItem(item, card.getId(), false, CODE_CARD_NOT_FOUND, null, false, false));
				continue;
			}

			boolean previousAccepted = hasAcceptedPreviousChain(userId, item, card.getId(), acceptedByClientId);
			if (!item.stateVersion().equals(state.getVersion()) && !previousAccepted) {
				results.set(index, batchItem(item, card.getId(), false, CODE_QUEUE_REFRESH, null, false, false));
				continue;
			}

			java.time.LocalDate learningDay = timeService.learningDay(settings.getRefreshTime(), request.timezone(),
					batchNow);
			ScheduleState scheduleState = fromEntity(state);
			ScheduleResult result;
			try {
				result = scheduleEngine.answer(scheduleState, request.queueType(), item.result(), learningDay, batchNow,
						Boolean.TRUE.equals(item.graduate()), Boolean.TRUE.equals(item.confirmForget()));
			}
			catch (SchedulingConflictException exception) {
				results.set(index, batchItem(item, card.getId(), false, CODE_QUEUE_REFRESH, null, false, false));
				continue;
			}
			catch (ConfirmationRequiredException exception) {
				results.set(index, batchItem(item, card.getId(), false, CODE_CONFIRMATION_REQUIRED, null, false, false));
				continue;
			}

			applyToEntity(state, result.state());
			cardStateRepository.saveAndFlush(state);
			AnswerEvent event = answerEventRepository.saveAndFlush(new AnswerEvent(user, card.getDeck(), card, batchNow,
					request.timezone(), learningDay, result.scene(), result.stageBefore(), result.stageAfter(),
					item.result()));

			QueueSimulationService.AdvanceResult advance = queueSimulationService.advance(queue, card, scheduleState,
					result.state());
			Long nextCardId = advance.nextCardId();
			boolean completed = advance.order().isEmpty();
			AnswerSubmission submission = answerSubmissionRepository
					.saveAndFlush(new AnswerSubmission(user, item.clientAnswerId(), card, item.result(),
							request.queueType(), request.timezone(), item.stateVersion(), item.previousClientAnswerId(),
							Boolean.TRUE.equals(item.graduate()), Boolean.TRUE.equals(item.confirmForget()), completed,
							nextCardId, event, batchNow));

			AnswerBatchDtos.AnswerItemResponse response = toBatchResponse(submission);
			acceptedByClientId.put(item.clientAnswerId(), response);
			results.set(index, response);
		}

		if (!acceptedByClientId.isEmpty()) {
			statisticsCacheService.invalidateDeck(userId, request.deckId());
		}
		return new AnswerBatchDtos.AnswerBatchResponse(List.copyOf(results));
	}

	private boolean hasAcceptedPreviousChain(Long userId, AnswerRequest request, Long cardId) {
		return request.previousClientAnswerId() != null && answerSubmissionRepository
				.findByUserIdAndCardIdAndClientRequestId(userId, cardId, request.previousClientAnswerId())
				.isPresent();
	}

	private boolean hasAcceptedPreviousChain(Long userId, AnswerBatchDtos.AnswerItemRequest request, Long cardId,
			Map<String, AnswerBatchDtos.AnswerItemResponse> acceptedByClientId) {
		if (request.previousClientAnswerId() == null) {
			return false;
		}
		if (acceptedByClientId.containsKey(request.previousClientAnswerId())) {
			return true;
		}
		return answerSubmissionRepository.findByUserIdAndCardIdAndClientRequestId(userId, cardId,
				request.previousClientAnswerId()).isPresent();
	}

	private AnswerResponse toResponse(AnswerSubmission submission) {
		return new AnswerResponse(submission.getCard().getId(), submission.getClientRequestId(), true,
				submission.getNextCardId(), submission.isCompleted(), false);
	}

	private AnswerBatchDtos.AnswerItemResponse toBatchResponse(AnswerSubmission submission) {
		return batchItem(submission.getClientRequestId(), submission.getCard().getId(), true, CODE_ACCEPTED,
				submission.getNextCardId(), submission.isCompleted(), false);
	}

	private AnswerBatchDtos.AnswerItemResponse batchItem(String clientAnswerId, Long cardId, boolean accepted,
			String code, Long nextCardId, boolean completed, boolean requiresConfirmation) {
		return new AnswerBatchDtos.AnswerItemResponse(cardId, clientAnswerId, accepted, code, nextCardId,
				completed, requiresConfirmation);
	}

	private AnswerBatchDtos.AnswerItemResponse batchItem(AnswerBatchDtos.AnswerItemRequest item, Long cardId,
			boolean accepted, String code, Long nextCardId, boolean completed, boolean requiresConfirmation) {
		return batchItem(item.clientAnswerId(), cardId, accepted, code, nextCardId, completed, requiresConfirmation);
	}

	private ScheduleState fromEntity(CardState state) {
		return new ScheduleState(state.getStage(), state.getQueueType(), state.getRelearnMode(),
				state.getRelearnOrigin(), state.getRelearnCorrectCount(), state.getDueDate(), state.getDueSince());
	}

	private void applyToEntity(CardState state, ScheduleState next) {
		state.setStage(next.stage());
		state.setQueueType(next.queueType());
		state.setRelearnMode(next.relearnMode());
		state.setRelearnOrigin(next.relearnOrigin());
		state.setRelearnCorrectCount(next.relearnCorrectCount());
		state.setDueDate(next.dueDate());
		state.setDueSince(next.dueSince());
	}
}
