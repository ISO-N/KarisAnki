package top.kariscode.karisanki.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import top.kariscode.karisanki.domain.deck.AnswerSubmission;

public interface AnswerSubmissionRepository extends JpaRepository<AnswerSubmission, Long> {

	Optional<AnswerSubmission> findByUserIdAndClientRequestId(Long userId, String clientRequestId);

	Optional<AnswerSubmission> findByUserIdAndCardIdAndClientRequestId(Long userId, Long cardId,
			String clientRequestId);

	Optional<AnswerSubmission> findByUserIdAndCardIdAndPreviousClientRequestId(Long userId, Long cardId,
			String previousClientRequestId);
}
