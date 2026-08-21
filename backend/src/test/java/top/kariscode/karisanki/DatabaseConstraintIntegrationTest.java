package top.kariscode.karisanki;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class DatabaseConstraintIntegrationTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void migrationsCreateUniqueAnswerSubmissionAndHistoryTables() {
		Integer uniqueConstraints = jdbcTemplate.queryForObject(
				"select count(*) from pg_constraint where conname = 'uk_answer_submissions_user_client'", Integer.class);
		assertTrue(uniqueConstraints > 0, "answer_submissions unique constraint is missing");

		Integer answerEvents = jdbcTemplate.queryForObject(
				"select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'answer_events'",
				Integer.class);
		assertTrue(answerEvents == 1, "answer_events table is missing");

		Integer historyName = jdbcTemplate.queryForObject(
				"select count(*) from information_schema.columns where table_name = 'answer_events' and column_name = 'deck_name'",
				Integer.class);
		assertTrue(historyName == 1, "answer_events deck_name history column is missing");
	}
}
