package top.kariscode.karisanki.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import top.kariscode.karisanki.domain.deck.Card;

public interface CardRepository extends JpaRepository<Card, Long> {

	@Query("""
			select c from Card c
			join c.deck d
			where c.id = :id and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			""")
	Optional<Card> findActiveByIdForUser(@Param("id") Long id, @Param("userId") Long userId);

	@Query("""
			select c from Card c
			join c.deck d
			join c.state cs
			where d.id = :deckId
			  and d.user.id = :userId
			  and c.deletedAt is null
			  and d.deletedAt is null
			  and (:query is null
			    or lower(c.front) like lower(concat('%', cast(:query as string), '%'))
			    or (c.back is not null and lower(c.back) like lower(concat('%', cast(:query as string), '%'))))
			  and (:status is null
			    or (:status = 'new' and cs.queueType = top.kariscode.karisanki.domain.CardQueue.NEW)
			    or (:status = 'review' and cs.queueType = top.kariscode.karisanki.domain.CardQueue.REVIEW and cs.stage between 0 and 8)
			    or (:status = 'relearn' and cs.queueType = top.kariscode.karisanki.domain.CardQueue.RELEARN)
			    or (:status = 'graduated' and cs.stage = 9))
			order by c.position asc, c.id asc
			""")
	Page<Card> searchInDeck(@Param("deckId") Long deckId, @Param("userId") Long userId,
			@Param("query") String query, @Param("status") String status, Pageable pageable);

	@Query("select coalesce(max(c.position), 0) from Card c where c.deck.id = :deckId and c.deletedAt is null")
	long maxPosition(@Param("deckId") Long deckId);

	@Query("select coalesce(min(c.position), 0) from Card c where c.deck.id = :deckId and c.deletedAt is null")
	long minPosition(@Param("deckId") Long deckId);

	@Query("""
			select c from Card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			order by c.position asc, c.id asc
			""")
	List<Card> findActiveByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId);

	@Query("""
			select c from Card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			order by c.createdAt asc, c.id asc
			""")
	List<Card> findActiveByDeckForUserOrderByCreatedAtAsc(@Param("deckId") Long deckId, @Param("userId") Long userId);
}
