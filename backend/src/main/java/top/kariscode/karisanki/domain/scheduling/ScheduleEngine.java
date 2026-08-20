package top.kariscode.karisanki.domain.scheduling;

import java.time.Instant;

import org.springframework.stereotype.Component;
import java.time.LocalDate;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.RelearnOrigin;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.StudyScene;

@Component
public class ScheduleEngine {

	private static final int[] INTERVAL_DAYS = { 0, 1, 2, 4, 7, 15, 30, 90, 180 };

	public ScheduleResult answer(ScheduleState state, StudyQueue queueType, AnswerResult result, LocalDate learningDay,
			Instant now, boolean graduate, boolean confirmForget) {
		if (state.queueType() == CardQueue.DONE || state.stage() == 9) {
			throw new SchedulingConflictException("毕业卡不能继续作答");
		}

		validateQueue(state, queueType, learningDay);


		if (state.queueType() == CardQueue.RELEARN) {
			return relearnAnswer(state, result, learningDay, now, confirmForget);
		}
		if (state.queueType() == CardQueue.NEW) {
			return newCardAnswer(state, result, learningDay, now);
		}
		return reviewAnswer(state, result, learningDay, now, graduate);
	}

	private void validateQueue(ScheduleState state, StudyQueue queueType, LocalDate learningDay) {
		if (state.queueType() == CardQueue.NEW && queueType != StudyQueue.LEARN) {
			throw new SchedulingConflictException("新卡只能在学习队列中作答");
		}
		if (state.queueType() == CardQueue.REVIEW && queueType != StudyQueue.REVIEW) {
			throw new SchedulingConflictException("复习卡只能在复习队列中作答");
		}
		if (state.queueType() == CardQueue.REVIEW && state.dueSince() == null
				&& (state.dueDate() == null || state.dueDate().isAfter(learningDay))) {
			throw new SchedulingConflictException("复习卡尚未到期");
		}
		if (state.queueType() == CardQueue.RELEARN) {
			boolean originMatches = (state.relearnOrigin() == RelearnOrigin.LEARN && queueType == StudyQueue.LEARN)
					|| (state.relearnOrigin() == RelearnOrigin.REVIEW && queueType == StudyQueue.REVIEW);
			if (!originMatches) {
				throw new SchedulingConflictException("重学卡不能进入触发它的队列之外的另一个队列");
			}
		}
	}

	private ScheduleResult newCardAnswer(ScheduleState state, AnswerResult result, LocalDate learningDay,
			Instant now) {
		if (result == AnswerResult.FAMILIAR) {
			ScheduleState next = new ScheduleState(0, CardQueue.REVIEW, RelearnMode.NONE, null, 0,
					learningDay.plusDays(1), null);
			return new ScheduleResult(next, StudyScene.LEARN, state.stage(), next.stage());
		}
		RelearnMode mode = result == AnswerResult.FORGOT ? RelearnMode.FORGOT : RelearnMode.BLURRY;
		ScheduleState next = new ScheduleState(state.stage(), CardQueue.RELEARN, mode, RelearnOrigin.LEARN, 0,
				learningDay, now);
		return new ScheduleResult(next, StudyScene.LEARN, state.stage(), next.stage());
	}

	private ScheduleResult reviewAnswer(ScheduleState state, AnswerResult result, LocalDate learningDay,
			Instant now, boolean graduate) {
		if (result == AnswerResult.FAMILIAR) {
			if (state.stage() == 8) {
				if (graduate) {
					ScheduleState next = new ScheduleState(9, CardQueue.DONE, RelearnMode.NONE, null, 0, null, null);
					return new ScheduleResult(next, StudyScene.REVIEW, state.stage(), next.stage());
				}
				ScheduleState next = new ScheduleState(8, CardQueue.REVIEW, RelearnMode.NONE, null, 0,
						learningDay.plusDays(INTERVAL_DAYS[8]), null);
				return new ScheduleResult(next, StudyScene.REVIEW, state.stage(), next.stage());
			}
			int nextStage = state.stage() + 1;
			ScheduleState next = new ScheduleState(nextStage, CardQueue.REVIEW, RelearnMode.NONE, null, 0,
					learningDay.plusDays(INTERVAL_DAYS[nextStage]), null);
			return new ScheduleResult(next, StudyScene.REVIEW, state.stage(), next.stage());
		}
		RelearnMode mode = result == AnswerResult.FORGOT ? RelearnMode.FORGOT : RelearnMode.BLURRY;
		ScheduleState next = new ScheduleState(state.stage(), CardQueue.RELEARN, mode, RelearnOrigin.REVIEW, 0,
				learningDay, now);
		return new ScheduleResult(next, StudyScene.REVIEW, state.stage(), next.stage());
	}

	private ScheduleResult relearnAnswer(ScheduleState state, AnswerResult result, LocalDate learningDay,
			Instant now, boolean confirmForget) {
		if (result == AnswerResult.FAMILIAR) {
			int required = state.relearnMode() == RelearnMode.FORGOT ? 5 : 3;
			int nextCount = state.relearnCorrectCount() + 1;
			if (nextCount < required) {
				ScheduleState next = new ScheduleState(state.stage(), CardQueue.RELEARN, state.relearnMode(),
						state.relearnOrigin(), nextCount, learningDay, now);
				return new ScheduleResult(next, StudyScene.RELEARN, state.stage(), next.stage());
			}
			int nextStage = finishRelearnStage(state);
			ScheduleState next = new ScheduleState(nextStage, CardQueue.REVIEW, RelearnMode.NONE, null, 0,
					learningDay.plusDays(1), null);
			return new ScheduleResult(next, StudyScene.RELEARN, state.stage(), next.stage());
		}
		if (result == AnswerResult.BLURRY) {
			ScheduleState next = new ScheduleState(state.stage(), CardQueue.RELEARN, state.relearnMode(),
					state.relearnOrigin(), 0, learningDay, now);
			return new ScheduleResult(next, StudyScene.RELEARN, state.stage(), next.stage());
		}
		if (state.relearnMode() == RelearnMode.BLURRY && !confirmForget) {
			throw new ConfirmationRequiredException("从模糊重学切换到忘记重学需要确认");
		}
		ScheduleState next = new ScheduleState(state.stage(), CardQueue.RELEARN, RelearnMode.FORGOT,
				state.relearnOrigin(), 0, learningDay, now);
		return new ScheduleResult(next, StudyScene.RELEARN, state.stage(), next.stage());
	}

	private int finishRelearnStage(ScheduleState state) {
		if (state.relearnMode() == RelearnMode.FORGOT || state.stage() <= 1) {
			return 0;
		}
		if (state.stage() == -1) {
			return 0;
		}
		return state.stage() - 1;
	}

	public int intervalDays(int stage) {
		if (stage < 0 || stage >= INTERVAL_DAYS.length) {
			return 0;
		}
		return INTERVAL_DAYS[stage];
	}
}
