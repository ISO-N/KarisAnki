package top.kariscode.karisanki.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import top.kariscode.karisanki.config.AppProperties;
import top.kariscode.karisanki.domain.UiLanguage;
import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSettings;
import top.kariscode.karisanki.repository.UserRepository;
import top.kariscode.karisanki.repository.UserSettingsRepository;
import top.kariscode.karisanki.security.AuthRateLimiter;
import top.kariscode.karisanki.security.SessionRegistryService;
import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.web.dto.AuthDtos;
import top.kariscode.karisanki.web.dto.SettingsDtos;
import top.kariscode.karisanki.web.error.BusinessException;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final UserSettingsRepository userSettingsRepository;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;
	private final SecurityContextRepository securityContextRepository;
	private final SessionRegistryService sessionRegistryService;
	private final AuthRateLimiter authRateLimiter;
	private final AppProperties properties;

	public AuthService(UserRepository userRepository, UserSettingsRepository userSettingsRepository,
			PasswordEncoder passwordEncoder, AuthenticationManager authenticationManager,
			SecurityContextRepository securityContextRepository, SessionRegistryService sessionRegistryService,
			AuthRateLimiter authRateLimiter, AppProperties properties) {
		this.userRepository = userRepository;
		this.userSettingsRepository = userSettingsRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.securityContextRepository = securityContextRepository;
		this.sessionRegistryService = sessionRegistryService;
		this.authRateLimiter = authRateLimiter;
		this.properties = properties;
	}

	@Transactional
	public AuthDtos.UserResponse register(AuthDtos.RegisterRequest request, HttpServletRequest servletRequest,
			HttpServletResponse servletResponse) {
		if (!properties.isRegistrationEnabled() || properties.getInviteCodes().isEmpty()) {
			throw BusinessException.unavailable("registration_unavailable", "注册尚未开放");
		}
		String email = normalizeEmail(request.email());
		String key = "register:" + clientIp(servletRequest) + ":" + email;
		authRateLimiter.check(key);

		if (userRepository.existsByEmail(email)) {
			throw BusinessException.conflict("email_exists", "该邮箱已注册");
		}
		if (properties.getInviteCodes().stream().noneMatch(code -> code.trim().equalsIgnoreCase(request.inviteCode().trim()))) {
			throw BusinessException.badRequest("invalid_invite_code", "邀请码无效");
		}

		User user = new User(email, passwordEncoder.encode(request.password()));
		UserSettings settings = new UserSettings(user);
		settings.setLanguage(request.language() == null ? UiLanguage.EN : request.language());
		user.setSettings(settings);
		userRepository.save(user);
		userSettingsRepository.save(settings);

		authenticate(email, request.password(), Boolean.TRUE.equals(request.rememberMe()), user, servletRequest,
				servletResponse);
		authRateLimiter.clear(key);
		return toUserResponse(user, settings);
	}

	@Transactional
	public AuthDtos.UserResponse login(AuthDtos.LoginRequest request, HttpServletRequest servletRequest,
			HttpServletResponse servletResponse) {
		String email = normalizeEmail(request.email());
		String key = "login:" + clientIp(servletRequest) + ":" + email;
		authRateLimiter.check(key);

		User user = userRepository.findByEmail(email)
				.orElseThrow(() -> BusinessException.unauthorized("invalid_credentials", "邮箱或密码错误"));
		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw BusinessException.unauthorized("invalid_credentials", "邮箱或密码错误");
		}

		authenticate(email, request.password(), Boolean.TRUE.equals(request.rememberMe()), user, servletRequest,
				servletResponse);
		authRateLimiter.clear(key);
		UserSettings settings = userSettingsRepository.findByUserId(user.getId()).orElseGet(() -> new UserSettings(user));
		return toUserResponse(user, settings);
	}

	public AuthDtos.UserResponse currentUser(Long userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> BusinessException.unauthorized("unauthenticated", "登录状态已失效"));
		UserSettings settings = settings(userId);
		return toUserResponse(user, settings);
	}

	public AuthDtos.RegistrationStatusResponse registrationStatus() {
		boolean enabled = properties.isRegistrationEnabled() && !properties.getInviteCodes().isEmpty();
		return new AuthDtos.RegistrationStatusResponse(enabled, true);
	}

	public UserSettings settings(Long userId) {
		return userSettingsRepository.findByUserId(userId)
				.orElseThrow(() -> BusinessException.notFound("settings_not_found", "用户设置不存在"));
	}

	public SettingsDtos.SettingsResponse settingsResponse(UserSettings settings) {
		return new SettingsDtos.SettingsResponse(settings.getUserId(), settings.getRefreshTime(),
				settings.getLanguage(), settings.getTheme());
	}

	private void authenticate(String email, String rawPassword, boolean rememberMe, User user,
			HttpServletRequest request, HttpServletResponse response) {
		Authentication authentication = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(email, rawPassword));
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(authentication);
		SecurityContextHolder.setContext(context);
		sessionRegistryService.register(request, user, rememberMe);
		securityContextRepository.saveContext(context, request, response);
	}

	private AuthDtos.UserResponse toUserResponse(User user, UserSettings settings) {
		return new AuthDtos.UserResponse(user.getId(), user.getEmail(), settingsResponse(settings));
	}

	private String normalizeEmail(String email) {
		return email == null ? "" : email.trim().toLowerCase();
	}

	private String clientIp(HttpServletRequest request) {
		String forwarded = request.getHeader("X-Forwarded-For");
		if (forwarded != null && !forwarded.isBlank()) {
			return forwarded.split(",")[0].trim();
		}
		return request.getRemoteAddr();
	}
}
