package top.kariscode.karisanki.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import top.kariscode.karisanki.domain.deck.Deck;

public interface DeckRepository extends JpaRepository<Deck, Long> {

	@Query("""
			select d from Deck d
			where d.id = :id and d.user.id = :userId and d.deletedAt is null
			""")
	Optional<Deck> findActiveByIdForUser(@Param("id") Long id, @Param("userId") Long userId);

	@Query("""
			select d from Deck d
			where d.user.id = :userId and d.deletedAt is null
			order by d.createdAt desc, d.id desc
			""")
	List<Deck> findActiveByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

	@Query("""
			select distinct d from Deck d
			where d.user.id = :userId
			  and exists (select e from top.kariscode.karisanki.domain.deck.AnswerEvent e where e.deck.id = d.id)
			order by d.name asc
			""")
	List<Deck> findHistoryDecksForUser(@Param("userId") Long userId);
}
