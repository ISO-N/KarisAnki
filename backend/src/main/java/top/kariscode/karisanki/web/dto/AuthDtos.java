package top.kariscode.karisanki.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import top.kariscode.karisanki.domain.UiLanguage;

public final class AuthDtos {

	private AuthDtos() {
	}

	public record RegisterRequest(
			@NotBlank @Email(message = "邮箱格式不正确") String email,
			@NotBlank @Size(min = 8, message = "密码至少 8 个字符") String password,
			@NotBlank String inviteCode,
			Boolean rememberMe,
			UiLanguage language) {
	}

	public record LoginRequest(
			@NotBlank String email,
			@NotBlank String password,
			Boolean rememberMe) {
	}

	public record RegistrationStatusResponse(boolean enabled, boolean inviteRequired) {
	}

	public record UserResponse(Long id, String email, SettingsDtos.SettingsResponse settings) {
	}
}
