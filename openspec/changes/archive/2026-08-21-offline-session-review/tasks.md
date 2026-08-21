## 1. Backend Data Model and DTOs

- [x] 1.1 Add Flyway `V3` migration that creates `answer_submissions` with `user_id`, `client_request_id`, `card_id`, `result`, `queue_type`, `timezone`, `state_version`, `previous_client_request_id`, `graduate`, `confirm_forget`, `completed`, `next_card_id`, `answer_event_id`, `created_at`, and a unique index on `(user_id, client_request_id)`.
- [x] 1.2 Add `AnswerSubmissionRepository` with lookup by user and `clientRequestId`, and by user, card, and `previousClientRequestId`.
- [x] 1.3 Extend `AnswerRequest` with required `clientAnswerId` and optional `previousClientAnswerId`.
- [x] 1.4 Replace `AnswerResponse.queue` with `clientAnswerId`, `accepted`, `nextCardId`, `completed`, and `requiresConfirmation`.
- [x] 1.5 Add session DTOs containing `deckId`, `type`, `timezone`, `order`, `cards`, and `total`.

## 2. Backend Session and Answer Behavior

- [x] 2.1 Refactor `QueueService` so a method returns the ordered active queue for a deck/type and the resolved card entities, reusing the existing queue composition and relearn insertion rules.
- [x] 2.2 Add `SessionController` and `SessionService` exposing `GET /api/decks/{deckId}/session?type=...&timezone=...`, with the response built from the ordered queue and full card content.
- [x] 2.3 Update `AnswerService` to generate a compact response after applying an answer and persist the corresponding `AnswerSubmission`.
- [x] 2.4 Implement idempotent replay: an existing `clientAnswerId` returns the stored accepted result and does not mutate card state or create a second `AnswerEvent`.
- [x] 2.5 Implement `previousClientAnswerId` chain validation so repeated relearn answers from the same offline sequence can be accepted even when `stateVersion` changed by the prior local answer.
- [x] 2.6 Return existing `queue_refresh`/`queue_conflict` errors for state mismatches that are not an idempotent replay or accepted local chain.
- [x] 2.7 Add backend integration tests for session snapshot, idempotent replay, no duplicate `AnswerEvent`, and conflict handling.

## 3. Frontend Network and Auth Foundation

- [x] 3.1 Extend `api.ts` with a default timeout, `AbortController` support, `ApiNetworkError`, and retry options limited to safe/idempotent requests.
- [x] 3.2 Add non-sensitive user cache persistence in `auth-context.tsx`; cache user ID, email, language, and theme after successful auth or `/api/auth/me`.
- [x] 3.3 Update `AuthProvider` so network errors keep cached user state and only 401 clears it.
- [x] 3.4 Update `RequireAuth` to render cached protected pages when the network is unavailable and no 401 has occurred.
- [x] 3.5 Add a small network status module or hook based on `navigator.onLine`, `online`, and `offline` events.
- [x] 3.6 Add i18n strings for offline, pending sync, syncing, synced, conflict, and retry states.

## 4. Client Session Storage and Outbox

- [x] 4.1 Add an IndexedDB module with `sessions` and `outbox` object stores; keep it wrapped behind a small typed API.
- [x] 4.2 Add session snapshot types and serialization/deserialization helpers.
- [x] 4.3 Implement session store operations: save, load by `deckId:type`, update progress, and clear completed sessions.
- [x] 4.4 Implement outbox operations: create with `crypto.randomUUID()`, list pending in order, mark accepted, mark conflicted, and remove.
- [x] 4.5 Implement a pure local queue mutation module that mirrors backend relearn insertion using `2^n` after removing the answered card.
- [x] 4.6 Add unit tests for the queue mutation module and outbox ordering.

## 5. Study Flow Integration and Sync Engine

- [x] 5.1 Refactor `StudySession` to load the session snapshot from the new API and store it in IndexedDB before starting.
- [x] 5.2 Update study flow to render cards from the local snapshot and use local queue mutation instead of per-card GET.
- [x] 5.3 Generate and persist an outbox entry before every rating; if online, attempt immediate idempotent submit, otherwise keep it pending.
- [x] 5.4 Add a sync service that listens to online/offline/visibility events, submits pending outbox entries in order, and applies successful `nextCardId` updates.
- [x] 5.5 Implement retry with backoff for network failures and preserve pending outbox entries.
- [x] 5.6 Implement conflict recovery: on `queue_refresh`/`queue_conflict`, fetch a fresh session, mark affected outbox entries as conflicted, and show the user how to continue.
- [x] 5.7 Add session resume behavior: if the app reloads with a local snapshot and pending outbox, offer to resume or refresh instead of silently discarding local work.
- [x] 5.8 Add sync/offline status UI to the study page without resetting the current card or progress.
- [x] 5.9 Keep the existing empty queue, graduate, and confirmation flows working with the new local session state.

## 6. Verification and Documentation

- [x] 6.1 Run backend `./mvnw test` against the real PostgreSQL test database and add any missing integration coverage.
- [x] 6.2 Run frontend `npm run lint`, `npm run build`, and the new frontend unit tests.
- [x] 6.3 Manually verify weak-network behavior with browser throttling: offline rating, pending count, reconnect sync, and conflict recovery.
- [x] 6.4 Update README/API docs and OpenSpec specs after the behavior is implemented.
