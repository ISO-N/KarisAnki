package top.kariscode.karisanki.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "karisanki")
public class AppProperties {

	private boolean registrationEnabled = true;

	private List<String> inviteCodes = new ArrayList<>();

	private int rateLimitMaxAttempts = 10;

	private Duration rateLimitWindow = Duration.ofMinutes(10);

	private final Import importConfig = new Import();

	public boolean isRegistrationEnabled() {
		return registrationEnabled;
	}

	public void setRegistrationEnabled(boolean registrationEnabled) {
		this.registrationEnabled = registrationEnabled;
	}

	public List<String> getInviteCodes() {
		return inviteCodes;
	}

	public void setInviteCodes(List<String> inviteCodes) {
		this.inviteCodes = inviteCodes;
	}

	public int getRateLimitMaxAttempts() {
		return rateLimitMaxAttempts;
	}

	public void setRateLimitMaxAttempts(int rateLimitMaxAttempts) {
		this.rateLimitMaxAttempts = rateLimitMaxAttempts;
	}

	public Duration getRateLimitWindow() {
		return rateLimitWindow;
	}

	public void setRateLimitWindow(Duration rateLimitWindow) {
		this.rateLimitWindow = rateLimitWindow;
	}

	public Import getImport() {
		return importConfig;
	}

	public static class Import {

		private int maxSourceBytes = 2 * 1024 * 1024;

		private int maxCards = 5000;

		public int getMaxSourceBytes() {
			return maxSourceBytes;
		}

		public void setMaxSourceBytes(int maxSourceBytes) {
			this.maxSourceBytes = maxSourceBytes;
		}

		public int getMaxCards() {
			return maxCards;
		}

		public void setMaxCards(int maxCards) {
			this.maxCards = maxCards;
		}
	}
}
