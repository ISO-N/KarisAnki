package top.kariscode.karisanki.domain.scheduling;

import java.time.Instant;
import java.time.LocalDate;

import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.RelearnOrigin;

public record ScheduleState(
		int stage,
		CardQueue queueType,
		RelearnMode relearnMode,
		RelearnOrigin relearnOrigin,
		int relearnCorrectCount,
		LocalDate dueDate,
		Instant dueSince) {

	public static ScheduleState newCard() {
		return new ScheduleState(-1, CardQueue.NEW, RelearnMode.NONE, null, 0, null, null);
	}
}
