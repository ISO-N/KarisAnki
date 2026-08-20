package top.kariscode.karisanki.domain.user;

import java.time.Instant;
import java.time.LocalTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import top.kariscode.karisanki.domain.ThemeMode;
import top.kariscode.karisanki.domain.UiLanguage;

@Entity
@Table(name = "user_settings")
public class UserSettings {

	@Id
	private Long userId;

	@OneToOne
	@MapsId
	@JoinColumn(name = "user_id")
	private User user;

	@Column(name = "refresh_time", nullable = false)
	private LocalTime refreshTime = LocalTime.of(4, 0);

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private UiLanguage language = UiLanguage.EN;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ThemeMode theme = ThemeMode.SYSTEM;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected UserSettings() {
	}

	public UserSettings(User user) {
		this.user = user;
		this.refreshTime = LocalTime.of(4, 0);
		this.language = UiLanguage.EN;
		this.theme = ThemeMode.SYSTEM;
		Instant now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public Long getUserId() {
		return userId;
	}

	public User getUser() {
		return user;
	}

	public LocalTime getRefreshTime() {
		return refreshTime;
	}

	public void setRefreshTime(LocalTime refreshTime) {
		this.refreshTime = refreshTime;
		this.updatedAt = Instant.now();
	}

	public UiLanguage getLanguage() {
		return language;
	}

	public void setLanguage(UiLanguage language) {
		this.language = language;
		this.updatedAt = Instant.now();
	}

	public ThemeMode getTheme() {
		return theme;
	}

	public void setTheme(ThemeMode theme) {
		this.theme = theme;
		this.updatedAt = Instant.now();
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
