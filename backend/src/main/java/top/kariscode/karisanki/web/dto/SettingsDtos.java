package top.kariscode.karisanki.web.dto;

import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import top.kariscode.karisanki.domain.ThemeMode;
import top.kariscode.karisanki.domain.UiLanguage;

public final class SettingsDtos {

	private SettingsDtos() {
	}

	public record SettingsResponse(Long userId, LocalTime refreshTime, UiLanguage language, ThemeMode theme) {
	}

	public record ChangePasswordRequest(
			@NotBlank String currentPassword,
			@NotBlank @Size(min = 8, message = "新密码至少 8 个字符") String newPassword) {
	}

	public record UpdateSettingsRequest(
			@NotNull LocalTime refreshTime,
			@NotNull UiLanguage language,
			@NotNull ThemeMode theme) {
	}
}
