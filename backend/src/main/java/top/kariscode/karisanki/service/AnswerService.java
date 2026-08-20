package top.kariscode.karisanki.service;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.deck.AnswerEvent;
import top.kariscode.karisanki.domain.deck.Card;
import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.domain.scheduling.ScheduleEngine;
import top.kariscode.karisanki.domain.scheduling.ScheduleResult;
import top.kariscode.karisanki.domain.scheduling.ScheduleState;
import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSettings;
import top.kariscode.karisanki.repository.AnswerEventRepository;
import top.kariscode.karisanki.repository.CardStateRepository;
import top.kariscode.karisanki.repository.UserRepository;
import top.kariscode.karisanki.web.dto.AnswerRequest;
import top.kariscode.karisanki.web.dto.AnswerResponse;
import top.kariscode.karisanki.web.error.BusinessException;

@Service
public class AnswerService {

	private final CardService cardService;
	private final AuthService authService;
	private final CardStateRepository cardStateRepository;
	private final AnswerEventRepository answerEventRepository;
	private final UserRepository userRepository;
	private final QueueService queueService;
	private final TimeService timeService;
	private final ScheduleEngine scheduleEngine;

	public AnswerService(CardService cardService, AuthService authService,
			CardStateRepository cardStateRepository, AnswerEventRepository answerEventRepository,
			UserRepository userRepository, QueueService queueService, TimeService timeService,
			ScheduleEngine scheduleEngine) {
		this.cardService = cardService;
		this.authService = authService;
		this.cardStateRepository = cardStateRepository;
		this.answerEventRepository = answerEventRepository;
		this.userRepository = userRepository;
		this.queueService = queueService;
		this.timeService = timeService;
		this.scheduleEngine = scheduleEngine;
	}

	@Transactional
	public AnswerResponse answer(Long userId, AnswerRequest request) {
		Card card = cardService.requireCard(userId, request.cardId());
		UserSettings settings = authService.settings(userId);
		CardState state = card.getState();
		if (state == null) {
			throw BusinessException.notFound("card_not_found", "卡片不存在");
		}
		if (!request.stateVersion().equals(state.getVersion())) {
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
		cardStateRepository.save(state);
		answerEventRepository.save(new AnswerEvent(user, card.getDeck(), card, now, timezone, learningDay,
				result.scene(), result.stageBefore(), result.stageAfter(), request.result()));

		StudyQueue queueType = request.queueType();
		var queue = queueService.queue(userId, card.getDeck().getId(), queueType, timezone);
		boolean completed = result.state().queueType() != CardQueue.RELEARN;
		Long nextCardId = queue.cardIds().isEmpty() ? null : queue.cardIds().get(0);
		return new AnswerResponse(card.getId(), nextCardId, queue.cardIds(), completed, false);
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
