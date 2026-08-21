package top.kariscode.karisanki.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.session.SessionRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSession;
import top.kariscode.karisanki.repository.UserSessionRepository;
import top.kariscode.karisanki.service.StatisticsCacheService;

class SessionRegistryServiceTest {

	@SuppressWarnings({ "rawtypes", "unchecked" })
	@Test
	void registerUsesRememberMeAndDefaultSessionDurations() {
		UserSessionRepository repository = mock(UserSessionRepository.class);
		SessionRepository sessionRepository = mock(SessionRepository.class);
		SessionRegistryService service = new SessionRegistryService(repository, sessionRepository, mock(StatisticsCacheService.class));

		HttpSession session = mock(HttpSession.class);
		when(session.getId()).thenReturn("remember-session");
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getSession(true)).thenReturn(session);
		when(repository.findById("remember-session")).thenReturn(Optional.empty());

		service.register(request, new User("user@example.com", "hash"), true);

		verify(session).setMaxInactiveInterval(30 * 24 * 60 * 60);

		HttpSession defaultSession = mock(HttpSession.class);
		when(defaultSession.getId()).thenReturn("default-session");
		HttpServletRequest defaultRequest = mock(HttpServletRequest.class);
		when(defaultRequest.getSession(true)).thenReturn(defaultSession);
		when(repository.findById("default-session")).thenReturn(Optional.empty());

		service.register(defaultRequest, new User("other@example.com", "hash"), false);
		verify(defaultSession).setMaxInactiveInterval(8 * 60 * 60);
	}

	@Test
	void logoutCurrentDeletesOnlyCurrentSession() {
		UserSessionRepository repository = mock(UserSessionRepository.class);
		SessionRepository<?> sessionRepository = mock(SessionRepository.class);
		StatisticsCacheService statisticsCacheService = mock(StatisticsCacheService.class);
		SessionRegistryService service = new SessionRegistryService(repository, sessionRepository, statisticsCacheService);

		HttpSession session = mock(HttpSession.class);
		when(session.getId()).thenReturn("current");
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getSession(false)).thenReturn(session);
		when(repository.findById("current")).thenReturn(Optional.of(new UserSession("current", 7L, Instant.now(), false)));

		service.logoutCurrent(request);

		verify(repository).deleteById("current");
		verify(session).invalidate();
		verify(statisticsCacheService).invalidateUser(7L);
	}

	@Test
	void logoutAllDeletesOtherAndCurrentSessions() {
		UserSessionRepository repository = mock(UserSessionRepository.class);
		SessionRepository<?> sessionRepository = mock(SessionRepository.class);
		StatisticsCacheService statisticsCacheService = mock(StatisticsCacheService.class);
		SessionRegistryService service = new SessionRegistryService(repository, sessionRepository, statisticsCacheService);

		UserSession other = new UserSession("other", 1L, Instant.now(), false);
		UserSession current = new UserSession("current", 1L, Instant.now(), false);
		when(repository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(other, current));

		HttpSession session = mock(HttpSession.class);
		when(session.getId()).thenReturn("current");
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getSession(false)).thenReturn(session);

		service.logoutAll(request, 1L);

		verify(sessionRepository).deleteById("other");
		verify(repository).deleteById("other");
		verify(repository).deleteById("current");
		verify(session).invalidate();
		verify(statisticsCacheService).invalidateUser(1L);
	}

	@Test
	void cleanupExpiredSessionsDeletesExpiredRows() {
		UserSessionRepository repository = mock(UserSessionRepository.class);
		SessionRepository<?> sessionRepository = mock(SessionRepository.class);
		SessionRegistryService service = new SessionRegistryService(repository, sessionRepository, mock(StatisticsCacheService.class));

		UserSession expired = new UserSession("expired", 1L, Instant.now().minusSeconds(1), false);
		when(repository.findByExpiresAtBefore(any())).thenReturn(List.of(expired));

		service.cleanupExpiredSessions();

		verify(sessionRepository).deleteById("expired");
		verify(repository).deleteAll(eq(List.of(expired)));
	}
}
