package top.kariscode.karisanki.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.deck.CardState;
import top.kariscode.karisanki.repository.CardStateRepository;

@Service
public class DueStateService {

	private final CardStateRepository cardStateRepository;

	public DueStateService(CardStateRepository cardStateRepository) {
		this.cardStateRepository = cardStateRepository;
	}

	@Transactional
	public void markDueStates(Long userId, LocalDate today, Instant now) {
		List<CardState> dueStates = cardStateRepository.findActiveDueReviewsWithoutDueSinceForUser(userId, today);
		for (CardState state : dueStates) {
			state.setDueSince(now);
			cardStateRepository.save(state);
		}
	}
}
