package top.kariscode.karisanki.domain.deck;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import top.kariscode.karisanki.domain.CardQueue;
import top.kariscode.karisanki.domain.RelearnMode;
import top.kariscode.karisanki.domain.RelearnOrigin;

@Entity
@Table(name = "card_states")
public class CardState {

	@Id
	private Long id;

	@OneToOne(fetch = FetchType.LAZY)
	@MapsId
	@JoinColumn(name = "card_id")
	private Card card;

	@Column(nullable = false)
	private int stage = -1;

	@Enumerated(EnumType.STRING)
	@Column(name = "queue_type", nullable = false, length = 20)
	private CardQueue queueType = CardQueue.NEW;

	@Enumerated(EnumType.STRING)
	@Column(name = "relearn_mode", nullable = false, length = 20)
	private RelearnMode relearnMode = RelearnMode.NONE;

	@Enumerated(EnumType.STRING)
	@Column(name = "relearn_origin", length = 20)
	private RelearnOrigin relearnOrigin;

	@Column(name = "relearn_correct_count", nullable = false)
	private int relearnCorrectCount;

	@Column(name = "due_date")
	private LocalDate dueDate;

	@Column(name = "due_since")
	private Instant dueSince;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private Long version;

	protected CardState() {
	}

	public CardState(Card card) {
		this.card = card;
		this.stage = -1;
		this.queueType = CardQueue.NEW;
		this.relearnMode = RelearnMode.NONE;
		this.relearnCorrectCount = 0;
		Instant now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
		this.version = 0L;
	}

	public Long getId() {
		return id;
	}

	public Card getCard() {
		return card;
	}

	public int getStage() {
		return stage;
	}

	public void setStage(int stage) {
		this.stage = stage;
		touch();
	}

	public CardQueue getQueueType() {
		return queueType;
	}

	public void setQueueType(CardQueue queueType) {
		this.queueType = queueType;
		touch();
	}

	public RelearnMode getRelearnMode() {
		return relearnMode;
	}

	public void setRelearnMode(RelearnMode relearnMode) {
		this.relearnMode = relearnMode;
		touch();
	}

	public RelearnOrigin getRelearnOrigin() {
		return relearnOrigin;
	}

	public void setRelearnOrigin(RelearnOrigin relearnOrigin) {
		this.relearnOrigin = relearnOrigin;
		touch();
	}

	public int getRelearnCorrectCount() {
		return relearnCorrectCount;
	}

	public void setRelearnCorrectCount(int relearnCorrectCount) {
		this.relearnCorrectCount = relearnCorrectCount;
		touch();
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public void setDueDate(LocalDate dueDate) {
		this.dueDate = dueDate;
		touch();
	}

	public Instant getDueSince() {
		return dueSince;
	}

	public void setDueSince(Instant dueSince) {
		this.dueSince = dueSince;
		touch();
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public Long getVersion() {
		return version;
	}

	private void touch() {
		this.updatedAt = Instant.now();
	}
}
