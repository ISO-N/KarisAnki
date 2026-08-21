package top.kariscode.karisanki.security;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.domain.user.UserSession;
import top.kariscode.karisanki.repository.UserSessionRepository;
import top.kariscode.karisanki.service.StatisticsCacheService;

@Service
public class SessionRegistryService {

	private static final long REMEMBER_ME_SECONDS = 30L * 24 * 60 * 60;
	private static final long DEFAULT_SECONDS = 8L * 60 * 60;

	private final UserSessionRepository userSessionRepository;
	private final SessionRepository<?> sessionRepository;
	private final StatisticsCacheService statisticsCacheService;

	public SessionRegistryService(UserSessionRepository userSessionRepository,
			SessionRepository<?> sessionRepository, StatisticsCacheService statisticsCacheService) {
		this.userSessionRepository = userSessionRepository;
		this.sessionRepository = sessionRepository;
		this.statisticsCacheService = statisticsCacheService;
	}

	@Scheduled(fixedDelayString = "${karisanki.session-cleanup-interval:6h}")
	@Transactional
	public void cleanupExpiredSessions() {
		List<UserSession> expired = userSessionRepository.findByExpiresAtBefore(Instant.now());
		for (UserSession session : expired) {
			try {
				sessionRepository.deleteById(session.getSessionId());
			}
			catch (Exception ignored) {
				// Spring Session may have already cleaned the row.
			}
		}
		userSessionRepository.deleteAll(expired);
	}

	@Transactional
	public void register(HttpServletRequest request, User user, boolean rememberMe) {
		HttpSession session = request.getSession(true);
		session.setAttribute(KarisSessionIdResolver.REMEMBER_ME_ATTRIBUTE, rememberMe);
		long seconds = rememberMe ? REMEMBER_ME_SECONDS : DEFAULT_SECONDS;
		session.setMaxInactiveInterval((int) seconds);

		String sessionId = session.getId();
		Instant expiresAt = Instant.now().plus(seconds, ChronoUnit.SECONDS);
		userSessionRepository.findById(sessionId).ifPresentOrElse(existing -> {
			existing.setLastSeenAt(Instant.now());
			userSessionRepository.save(existing);
		}, () -> userSessionRepository.save(new UserSession(sessionId, user.getId(), expiresAt, rememberMe)));
	}

	@Transactional
	public void logoutCurrent(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session == null) {
			return;
		}
		String sessionId = session.getId();
		userSessionRepository.findById(sessionId)
				.ifPresent(row -> statisticsCacheService.invalidateUser(row.getUserId()));
		userSessionRepository.deleteById(sessionId);
		session.invalidate();
	}

	@Transactional
	public void logoutAll(HttpServletRequest request, Long userId) {
		HttpSession currentSession = request.getSession(false);
		String currentSessionId = currentSession != null ? currentSession.getId() : null;

		userSessionRepository.findByUserIdOrderByCreatedAtDesc(userId).forEach(row -> {
			if (!row.getSessionId().equals(currentSessionId)) {
				try {
					sessionRepository.deleteById(row.getSessionId());
				}
				catch (Exception ignored) {
					// Spring Session may already have cleaned the row.
				}
				userSessionRepository.deleteById(row.getSessionId());
			}
		});

		statisticsCacheService.invalidateUser(userId);

		if (currentSession != null) {
			userSessionRepository.deleteById(currentSessionId);
			currentSession.invalidate();
		}
	}
}
