package top.kariscode.karisanki.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import top.kariscode.karisanki.domain.RelearnOrigin;
import top.kariscode.karisanki.domain.deck.CardState;

public interface CardStateRepository extends JpaRepository<CardState, Long> {

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where cs.card.id = :cardId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			""")
	Optional<CardState> findActiveByCardIdForUser(@Param("cardId") Long cardId, @Param("userId") Long userId);

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.NEW
			order by c.position asc, c.id asc
			""")
	List<CardState> findActiveNewByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId);

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.REVIEW
			  and cs.stage between 0 and 8
			  and (cs.dueSince is not null
			    or (cs.dueDate is not null and cs.dueDate <= :today))
			""")
	List<CardState> findActiveReviewByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId,
			@Param("today") LocalDate today);

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.RELEARN
			  and cs.relearnOrigin = :origin
			order by cs.updatedAt asc, cs.id asc
			""")
	List<CardState> findActiveRelearnByDeckAndOriginForUser(@Param("deckId") Long deckId,
			@Param("userId") Long userId, @Param("origin") RelearnOrigin origin);

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.REVIEW
			  and cs.stage between 0 and 8
			  and cs.dueDate is not null and cs.dueDate <= :today
			  and cs.dueSince is null
			""")
	List<CardState> findActiveDueReviewsWithoutDueSinceForUser(@Param("userId") Long userId,
			@Param("today") LocalDate today);

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			""")
	List<CardState> findActiveForUser(@Param("userId") Long userId);

	@Query("""
			select cs from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			""")
	List<CardState> findActiveByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId);

	@Query("""
			select d.id as deckId,
			  sum(case when cs.queueType = top.kariscode.karisanki.domain.CardQueue.NEW then 1L else 0L end) as newCount,
			  sum(case when cs.queueType = top.kariscode.karisanki.domain.CardQueue.RELEARN then 1L else 0L end) as relearnCount,
			  sum(case when cs.queueType = top.kariscode.karisanki.domain.CardQueue.REVIEW
			    and cs.stage between 0 and 8
			    and (cs.dueSince is not null or (cs.dueDate is not null and cs.dueDate <= :today))
			    then 1L else 0L end) as dueCount
			from CardState cs
			join cs.card c
			join c.deck d
			where d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			group by d.id
			""")
	List<DeckCountProjection> countActiveByUser(@Param("userId") Long userId, @Param("today") LocalDate today);

	interface DeckCountProjection {
		Long getDeckId();

		long getNewCount();

		long getRelearnCount();

		long getDueCount();
	}

	@Query("""
			select count(cs) from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.NEW
			""")
	long countNewByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId);

	@Query("""
			select count(cs) from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.RELEARN
			""")
	long countRelearnByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId);

	@Query("""
			select count(cs) from CardState cs
			join cs.card c
			join c.deck d
			where d.id = :deckId and d.user.id = :userId and c.deletedAt is null and d.deletedAt is null
			  and cs.queueType = top.kariscode.karisanki.domain.CardQueue.REVIEW
			  and cs.stage between 0 and 8
			  and (cs.dueSince is not null
			    or (cs.dueDate is not null and cs.dueDate <= :today))
			""")
	long countDueByDeckForUser(@Param("deckId") Long deckId, @Param("userId") Long userId, @Param("today") LocalDate today);
}
