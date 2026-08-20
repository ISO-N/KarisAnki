package top.kariscode.karisanki.domain.user;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sessions")
public class UserSession {

	@Id
	@Column(name = "session_id", nullable = false, length = 36)
	private String sessionId;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "last_seen_at")
	private Instant lastSeenAt;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(name = "remember_me", nullable = false)
	private boolean rememberMe;

	protected UserSession() {
	}

	public UserSession(String sessionId, Long userId, Instant expiresAt, boolean rememberMe) {
		this.sessionId = sessionId;
		this.userId = userId;
		this.createdAt = Instant.now();
		this.lastSeenAt = createdAt;
		this.expiresAt = expiresAt;
		this.rememberMe = rememberMe;
	}

	public String getSessionId() {
		return sessionId;
	}

	public Long getUserId() {
		return userId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getLastSeenAt() {
		return lastSeenAt;
	}

	public void setLastSeenAt(Instant lastSeenAt) {
		this.lastSeenAt = lastSeenAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public boolean isRememberMe() {
		return rememberMe;
	}
}
