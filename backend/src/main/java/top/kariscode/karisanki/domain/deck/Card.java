package top.kariscode.karisanki.domain.deck;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "cards")
public class Card {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "deck_id", nullable = false)
	private Deck deck;

	@Column(nullable = false, columnDefinition = "text")
	private String front;

	@Column(columnDefinition = "text")
	private String back;

	@Column(columnDefinition = "text")
	private String phonetic;

	@Column(nullable = false)
	private long position;

	@Column(name = "deleted_at")
	private Instant deletedAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@OneToOne(mappedBy = "card", cascade = jakarta.persistence.CascadeType.ALL, optional = false)
	private CardState state;

	protected Card() {
	}

	public Card(Deck deck, String front, String back, long position) {
		this.deck = deck;
		this.front = front;
		this.back = back;
		this.position = position;
		Instant now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public Long getId() {
		return id;
	}

	public Deck getDeck() {
		return deck;
	}

	public String getFront() {
		return front;
	}

	public void updateContent(String front, String back) {
		this.front = front;
		this.back = back;
		this.updatedAt = Instant.now();
	}

	public String getBack() {
		return back;
	}

	public String getPhonetic() {
		return phonetic;
	}

	public void setPhonetic(String phonetic) {
		this.phonetic = phonetic;
	}

	public long getPosition() {
		return position;
	}

	public void setPosition(long position) {
		this.position = position;
		this.updatedAt = Instant.now();
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public void delete() {
		this.deletedAt = Instant.now();
		this.updatedAt = deletedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public CardState getState() {
		return state;
	}

	public void setState(CardState state) {
		this.state = state;
	}
}
