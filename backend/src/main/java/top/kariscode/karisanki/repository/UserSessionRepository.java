package top.kariscode.karisanki.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import top.kariscode.karisanki.domain.user.UserSession;

public interface UserSessionRepository extends JpaRepository<UserSession, String> {

	List<UserSession> findByUserIdOrderByCreatedAtDesc(Long userId);

	List<UserSession> findByExpiresAtBefore(Instant expiresAt);
}
