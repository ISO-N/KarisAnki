package top.kariscode.karisanki.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import top.kariscode.karisanki.domain.user.UserSettings;

public interface UserSettingsRepository extends JpaRepository<UserSettings, Long> {

	Optional<UserSettings> findByUserId(Long userId);
}
