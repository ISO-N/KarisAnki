ALTER TABLE answer_events ADD COLUMN queue_type VARCHAR(20);

UPDATE answer_events
SET queue_type = 'LEARN'
WHERE scene = 'LEARN' OR stage_before = -1;

UPDATE answer_events
SET queue_type = 'REVIEW'
WHERE queue_type IS NULL;

ALTER TABLE answer_events ALTER COLUMN queue_type SET NOT NULL;

CREATE INDEX idx_answer_events_user_queue ON answer_events(user_id, queue_type);
