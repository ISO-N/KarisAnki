package top.kariscode.karisanki.domain.scheduling;

import top.kariscode.karisanki.domain.StudyScene;

public record ScheduleResult(ScheduleState state, StudyScene scene, int stageBefore, int stageAfter) {
}
