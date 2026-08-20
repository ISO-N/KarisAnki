package top.kariscode.karisanki.domain.deck;

import java.time.Instant;
import java.time.LocalDate;

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
import top.kariscode.karisanki.domain.StudyScene;
import top.kariscode.karisanki.domain.user.User;

@Entity
@Table(name = "answer_events")
public class AnswerEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "deck_id", nullable = false)
	private Deck deck;

	@Column(name = "deck_name", nullable = false, length = 120)
	private String deckName;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "card_id", nullable = false)
	private Card card;

	@Column(name = "answered_at", nullable = false)
	private Instant answeredAt;

	@Column(nullable = false, length = 64)
	private String timezone;

	@Column(name = "learning_day", nullable = false)
	private LocalDate learningDay;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private StudyScene scene;

	@Column(name = "stage_before", nullable = false)
	private int stageBefore;

	@Column(name = "stage_after", nullable = false)
	private int stageAfter;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private AnswerResult result;

	protected AnswerEvent() {
	}

	public AnswerEvent(User user, Deck deck, Card card, Instant answeredAt, String timezone, LocalDate learningDay,
			StudyScene scene, int stageBefore, int stageAfter, AnswerResult result) {
		this.user = user;
		this.deck = deck;
		this.deckName = deck.getName();
		this.card = card;
		this.answeredAt = answeredAt;
		this.timezone = timezone;
		this.learningDay = learningDay;
		this.scene = scene;
		this.stageBefore = stageBefore;
		this.stageAfter = stageAfter;
		this.result = result;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public Deck getDeck() {
		return deck;
	}

	public String getDeckName() {
		return deckName;
	}

	public Card getCard() {
		return card;
	}

	public Instant getAnsweredAt() {
		return answeredAt;
	}

	public String getTimezone() {
		return timezone;
	}

	public LocalDate getLearningDay() {
		return learningDay;
	}

	public StudyScene getScene() {
		return scene;
	}

	public int getStageBefore() {
		return stageBefore;
	}

	public int getStageAfter() {
		return stageAfter;
	}

	public AnswerResult getResult() {
		return result;
	}
}
