package top.kariscode.karisanki.security;

import java.time.Duration;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.session.web.http.HttpSessionIdResolver;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@Component
public class KarisSessionIdResolver implements HttpSessionIdResolver {

	public static final String SESSION_COOKIE_NAME = "KARISANKI_SESSION";
	public static final String REMEMBER_ME_ATTRIBUTE = "karisanki.remember-me";

	private final boolean secure;

	public KarisSessionIdResolver(@Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
		this.secure = secure;
	}

	@Override
	public List<String> resolveSessionIds(HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return List.of();
		}
		for (Cookie cookie : cookies) {
			if (SESSION_COOKIE_NAME.equals(cookie.getName()) && cookie.getValue() != null
					&& !cookie.getValue().isBlank()) {
				return List.of(cookie.getValue());
			}
		}
		return List.of();
	}

	@Override
	public void setSessionId(HttpServletRequest request, HttpServletResponse response, String sessionId) {
		if (sessionId == null || sessionId.isBlank()) {
			return;
		}
		boolean rememberMe = false;
		HttpSession session = request.getSession(false);
		if (session != null) {
			rememberMe = Boolean.TRUE.equals(session.getAttribute(REMEMBER_ME_ATTRIBUTE));
		}
		long maxAge = rememberMe ? Duration.ofDays(30).toSeconds() : -1;
		ResponseCookie cookie = ResponseCookie.from(SESSION_COOKIE_NAME, sessionId)
				.path("/")
				.httpOnly(true)
				.secure(secure)
				.sameSite("Lax")
				.maxAge(maxAge)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	@Override
	public void expireSession(HttpServletRequest request, HttpServletResponse response) {
		ResponseCookie cookie = ResponseCookie.from(SESSION_COOKIE_NAME, "")
				.path("/")
				.httpOnly(true)
				.secure(secure)
				.sameSite("Lax")
				.maxAge(0)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}
}
