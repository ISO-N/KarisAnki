package top.kariscode.karisanki.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import top.kariscode.karisanki.domain.deck.AnswerEvent;

public interface AnswerEventRepository extends JpaRepository<AnswerEvent, Long> {

	List<AnswerEvent> findByUserIdOrderByAnsweredAtAsc(Long userId);

	List<AnswerEvent> findByUserIdAndDeckIdOrderByAnsweredAtAsc(Long userId, Long deckId);

	@Query("""
			select distinct e.deck from AnswerEvent e
			where e.user.id = :userId
			order by e.deck.name asc
			""")
	List<top.kariscode.karisanki.domain.deck.Deck> findHistoryDecks(@Param("userId") Long userId);
}
