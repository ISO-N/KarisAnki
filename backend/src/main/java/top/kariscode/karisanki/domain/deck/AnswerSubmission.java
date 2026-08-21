package top.kariscode.karisanki.domain.deck;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import top.kariscode.karisanki.domain.AnswerResult;
import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.domain.user.User;

@Entity
@Table(name = "answer_submissions")
public class AnswerSubmission {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "client_request_id", nullable = false, length = 36)
	private String clientRequestId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "card_id", nullable = false)
	private Card card;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private AnswerResult result;

	@Enumerated(EnumType.STRING)
	@Column(name = "queue_type", nullable = false, length = 20)
	private StudyQueue queueType;

	@Column(nullable = false, length = 64)
	private String timezone;

	@Column(name = "state_version", nullable = false)
	private Long stateVersion;

	@Column(name = "previous_client_request_id")
	private String previousClientRequestId;

	@Column(nullable = false)
	private boolean graduate;

	@Column(name = "confirm_forget", nullable = false)
	private boolean confirmForget;

	@Column(nullable = false)
	private boolean completed;

	@Column(name = "next_card_id")
	private Long nextCardId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "answer_event_id", nullable = false)
	private AnswerEvent answerEvent;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected AnswerSubmission() {
	}

	public AnswerSubmission(User user, String clientRequestId, Card card, AnswerResult result, StudyQueue queueType,
			String timezone, Long stateVersion, String previousClientRequestId, boolean graduate,
			boolean confirmForget, boolean completed, Long nextCardId, AnswerEvent answerEvent, Instant createdAt) {
		this.user = user;
		this.clientRequestId = clientRequestId;
		this.card = card;
		this.result = result;
		this.queueType = queueType;
		this.timezone = timezone;
		this.stateVersion = stateVersion;
		this.previousClientRequestId = previousClientRequestId;
		this.graduate = graduate;
		this.confirmForget = confirmForget;
		this.completed = completed;
		this.nextCardId = nextCardId;
		this.answerEvent = answerEvent;
		this.createdAt = createdAt;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public String getClientRequestId() {
		return clientRequestId;
	}

	public Card getCard() {
		return card;
	}

	public AnswerResult getResult() {
		return result;
	}

	public StudyQueue getQueueType() {
		return queueType;
	}

	public String getTimezone() {
		return timezone;
	}

	public Long getStateVersion() {
		return stateVersion;
	}

	public String getPreviousClientRequestId() {
		return previousClientRequestId;
	}

	public boolean isGraduate() {
		return graduate;
	}

	public boolean isConfirmForget() {
		return confirmForget;
	}

	public boolean isCompleted() {
		return completed;
	}

	public Long getNextCardId() {
		return nextCardId;
	}

	public AnswerEvent getAnswerEvent() {
		return answerEvent;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
