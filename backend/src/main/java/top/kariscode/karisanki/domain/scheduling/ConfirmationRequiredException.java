package top.kariscode.karisanki.domain.scheduling;

public class ConfirmationRequiredException extends RuntimeException {

	public ConfirmationRequiredException(String message) {
		super(message);
	}
}
