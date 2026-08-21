package top.kariscode.karisanki.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import top.kariscode.karisanki.domain.StudyQueue;
import top.kariscode.karisanki.web.dto.SessionDtos;

@Service
public class SessionService {

	private final QueueService queueService;
	private final CardService cardService;

	public SessionService(QueueService queueService, CardService cardService) {
		this.queueService = queueService;
		this.cardService = cardService;
	}

	@Transactional
	public SessionDtos.SessionResponse session(Long userId, Long deckId, StudyQueue type, String timezone) {
		QueueService.QueueSnapshot snapshot = queueService.sessionQueue(userId, deckId, type, timezone);
		return new SessionDtos.SessionResponse(deckId, type.name(), timezone, snapshot.order(),
				snapshot.cards().stream().map(cardService::toResponse).toList(), snapshot.order().size());
	}
}
