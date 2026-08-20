package top.kariscode.karisanki.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.AuthService;
import top.kariscode.karisanki.service.SettingsService;
import top.kariscode.karisanki.web.dto.SettingsDtos;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

	private final SettingsService settingsService;
	private final AuthService authService;

	public SettingsController(SettingsService settingsService, AuthService authService) {
		this.settingsService = settingsService;
		this.authService = authService;
	}

	@GetMapping
	public SettingsDtos.SettingsResponse get(@AuthenticationPrincipal UserPrincipal principal) {
		return authService.settingsResponse(authService.settings(principal.id()));
	}

	@PutMapping
	public SettingsDtos.SettingsResponse update(@AuthenticationPrincipal UserPrincipal principal,
			@Valid @RequestBody SettingsDtos.UpdateSettingsRequest request) {
		return settingsService.update(principal.id(), request);
	}

	@PutMapping("/password")
	public void changePassword(@AuthenticationPrincipal UserPrincipal principal,
			@Valid @RequestBody SettingsDtos.ChangePasswordRequest request) {
		settingsService.changePassword(principal.id(), request.currentPassword(), request.newPassword());
	}
}
