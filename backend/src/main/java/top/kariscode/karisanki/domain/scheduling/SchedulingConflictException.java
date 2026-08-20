package top.kariscode.karisanki.domain.scheduling;

public class SchedulingConflictException extends RuntimeException {

	public SchedulingConflictException(String message) {
		super(message);
	}
}
