package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import top.kariscode.karisanki.config.AppProperties;
import top.kariscode.karisanki.domain.UiLanguage;
import top.kariscode.karisanki.repository.UserRepository;
import top.kariscode.karisanki.repository.UserSettingsRepository;
import top.kariscode.karisanki.security.AuthRateLimiter;
import top.kariscode.karisanki.security.SessionRegistryService;
import top.kariscode.karisanki.web.dto.AuthDtos;
import top.kariscode.karisanki.web.error.BusinessException;

class AuthServiceTest {

	@Test
	void registrationIsBlockedWhenDisabledOrNoInviteCodesAreConfigured() {
		AppProperties properties = new AppProperties();
		properties.setRegistrationEnabled(false);
		properties.setInviteCodes(java.util.List.of("testcode"));

		UserRepository userRepository = mock(UserRepository.class);
		AuthService service = new AuthService(userRepository, mock(UserSettingsRepository.class),
				mock(PasswordEncoder.class), mock(AuthenticationManager.class),
				mock(SecurityContextRepository.class), mock(SessionRegistryService.class),
				mock(AuthRateLimiter.class), properties);

		BusinessException exception = assertThrows(BusinessException.class, () -> service.register(
				new AuthDtos.RegisterRequest("User@Example.com", "password123", "testcode", false, UiLanguage.ZH),
				mock(HttpServletRequest.class), mock(HttpServletResponse.class)));

		assertEquals("registration_unavailable", exception.getCode());
		verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());

		properties.setRegistrationEnabled(true);
		properties.setInviteCodes(java.util.List.of());
		assertEquals(false, service.registrationStatus().enabled());
	}
	@Test
	void duplicateEmailIsRejectedBeforeInviteValidation() {
		AppProperties properties = new AppProperties();
		properties.setRegistrationEnabled(true);
		properties.setInviteCodes(java.util.List.of("testcode"));

		UserRepository userRepository = mock(UserRepository.class);
		when(userRepository.existsByEmail("user@example.com")).thenReturn(true);
		AuthService service = service(userRepository, properties);
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getRemoteAddr()).thenReturn("127.0.0.1");

		BusinessException exception = assertThrows(BusinessException.class, () -> service.register(
				new AuthDtos.RegisterRequest("User@Example.com", "password123", "testcode", false, UiLanguage.ZH),
				request, mock(HttpServletResponse.class)));
		assertEquals("email_exists", exception.getCode());
		verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
	}

	@Test
	void invalidInviteCodeIsRejected() {
		AppProperties properties = new AppProperties();
		properties.setRegistrationEnabled(true);
		properties.setInviteCodes(java.util.List.of("testcode"));

		UserRepository userRepository = mock(UserRepository.class);
		when(userRepository.existsByEmail("user@example.com")).thenReturn(false);
		AuthService service = service(userRepository, properties);
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getRemoteAddr()).thenReturn("127.0.0.1");

		BusinessException exception = assertThrows(BusinessException.class, () -> service.register(
				new AuthDtos.RegisterRequest("User@Example.com", "password123", "wrong", false, UiLanguage.ZH),
				request, mock(HttpServletResponse.class)));
		assertEquals("invalid_invite_code", exception.getCode());
		verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
	}

	private AuthService service(UserRepository userRepository, AppProperties properties) {
		return new AuthService(userRepository, mock(UserSettingsRepository.class), mock(PasswordEncoder.class),
				mock(AuthenticationManager.class), mock(SecurityContextRepository.class),
				mock(SessionRegistryService.class), mock(AuthRateLimiter.class), properties);
}
}
