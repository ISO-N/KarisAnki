package top.kariscode.karisanki.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSettings;
import top.kariscode.karisanki.repository.UserRepository;
import top.kariscode.karisanki.repository.UserSettingsRepository;
import top.kariscode.karisanki.web.dto.SettingsDtos;
import top.kariscode.karisanki.web.error.BusinessException;

@Service
public class SettingsService {

	private final UserRepository userRepository;
	private final UserSettingsRepository userSettingsRepository;
	private final PasswordEncoder passwordEncoder;
	private final StatisticsCacheService statisticsCacheService;

	public SettingsService(UserRepository userRepository, UserSettingsRepository userSettingsRepository,
			PasswordEncoder passwordEncoder, StatisticsCacheService statisticsCacheService) {
		this.userRepository = userRepository;
		this.userSettingsRepository = userSettingsRepository;
		this.passwordEncoder = passwordEncoder;
		this.statisticsCacheService = statisticsCacheService;
	}

	@Transactional
	public SettingsDtos.SettingsResponse update(Long userId, SettingsDtos.UpdateSettingsRequest request) {
		if (request.refreshTime().getMinute() % 15 != 0 || request.refreshTime().getSecond() != 0) {
			throw BusinessException.badRequest("invalid_refresh_time", "刷新时间必须按 15 分钟粒度设置");
		}
		UserSettings settings = userSettingsRepository.findByUserId(userId)
				.orElseThrow(() -> BusinessException.notFound("settings_not_found", "用户设置不存在"));
		settings.setRefreshTime(request.refreshTime());
		settings.setLanguage(request.language());
		settings.setTheme(request.theme());
		userSettingsRepository.save(settings);
		statisticsCacheService.invalidateUser(userId);
		return new SettingsDtos.SettingsResponse(settings.getUserId(), settings.getRefreshTime(),
				settings.getLanguage(), settings.getTheme());
	}

	@Transactional
	public void changePassword(Long userId, String currentPassword, String newPassword) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> BusinessException.notFound("user_not_found", "用户不存在"));
		if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
			throw BusinessException.badRequest("current_password_incorrect", "当前密码错误");
		}
		user.setPasswordHash(passwordEncoder.encode(newPassword));
		userRepository.save(user);
	}
}
