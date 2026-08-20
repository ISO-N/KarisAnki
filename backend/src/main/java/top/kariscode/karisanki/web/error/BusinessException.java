package top.kariscode.karisanki.web.error;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

	private final HttpStatus status;
	private final String code;

	public BusinessException(HttpStatus status, String code, String message) {
		super(message);
		this.status = status;
		this.code = code;
	}

	public static BusinessException badRequest(String code, String message) {
		return new BusinessException(HttpStatus.BAD_REQUEST, code, message);
	}

	public static BusinessException conflict(String code, String message) {
		return new BusinessException(HttpStatus.CONFLICT, code, message);
	}

	public static BusinessException notFound(String code, String message) {
		return new BusinessException(HttpStatus.NOT_FOUND, code, message);
	}

	public static BusinessException unauthorized(String code, String message) {
		return new BusinessException(HttpStatus.UNAUTHORIZED, code, message);
	}

	public static BusinessException rateLimited(String message) {
		return new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", message);
	}

	public static BusinessException unavailable(String code, String message) {
		return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, code, message);
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}
}
