package top.kariscode.karisanki.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import top.kariscode.karisanki.domain.user.User;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);
}
