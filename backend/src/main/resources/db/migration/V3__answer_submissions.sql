CREATE TABLE answer_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_request_id VARCHAR(36) NOT NULL,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    result VARCHAR(20) NOT NULL,
    queue_type VARCHAR(20) NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    state_version BIGINT NOT NULL,
    previous_client_request_id VARCHAR(36),
    graduate BOOLEAN NOT NULL,
    confirm_forget BOOLEAN NOT NULL,
    completed BOOLEAN NOT NULL,
    next_card_id BIGINT,
    answer_event_id BIGINT NOT NULL REFERENCES answer_events(id),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_answer_submissions_user_client UNIQUE (user_id, client_request_id)
);

CREATE INDEX idx_answer_submissions_user_client ON answer_submissions(user_id, client_request_id);
CREATE INDEX idx_answer_submissions_user_card_previous ON answer_submissions(user_id, card_id, previous_client_request_id);
