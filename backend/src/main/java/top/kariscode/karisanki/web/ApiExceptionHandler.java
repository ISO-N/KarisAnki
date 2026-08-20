package top.kariscode.karisanki.web;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import top.kariscode.karisanki.domain.scheduling.ConfirmationRequiredException;
import top.kariscode.karisanki.domain.scheduling.SchedulingConflictException;
import top.kariscode.karisanki.web.error.BusinessException;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(BusinessException.class)
	public ResponseEntity<Map<String, String>> handleBusiness(BusinessException exception) {
		return ResponseEntity.status(exception.getStatus())
				.body(Map.of("code", exception.getCode(), "message", exception.getMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
		String message = exception.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(error -> error.getDefaultMessage())
				.orElse("请求参数不正确");
		return ResponseEntity.badRequest().body(Map.of("code", "validation_error", "message", message));
	}

	@ExceptionHandler(ConfirmationRequiredException.class)
	public ResponseEntity<Map<String, String>> handleConfirmation(ConfirmationRequiredException exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(Map.of("code", "confirmation_required", "message", exception.getMessage()));
	}

	@ExceptionHandler(SchedulingConflictException.class)
	public ResponseEntity<Map<String, String>> handleSchedulingConflict(SchedulingConflictException exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(Map.of("code", "queue_conflict", "message", exception.getMessage()));
	}

	@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
	public ResponseEntity<Map<String, String>> handleOptimisticLock(ObjectOptimisticLockingFailureException exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(Map.of("code", "queue_refresh", "message", "卡片状态已变化，请刷新队列"));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<Map<String, String>> handleUnexpected(Exception exception) {
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
				.body(Map.of("code", "internal_error", "message", "服务器内部错误"));
	}
}
