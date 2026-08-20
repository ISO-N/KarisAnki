CREATE INDEX idx_cards_front_search ON cards ((lower(front)));
CREATE INDEX idx_cards_back_search ON cards ((lower(back)));
CREATE INDEX idx_card_states_due_since ON card_states (queue_type, due_date, due_since);
CREATE INDEX idx_card_states_relearn_progress ON card_states (queue_type, relearn_origin, relearn_correct_count);
