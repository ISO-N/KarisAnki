## 1. Contract and Traceability Foundation

- [x] 1.1 Create `contracts/openapi.yaml` covering all current `/api/*` endpoints, DTOs, enums, status codes, and error codes.
- [x] 1.2 Add `contracts/scheduling-vectors.json` with initial states, answer sequences, expected stage/relearn progress, next card, and queue insertion positions.
- [x] 1.3 Create `tests/coverage.yaml` mapping each current OpenSpec capability/requirement/scenario to a concrete backend, frontend, or E2E test.
- [x] 1.4 Add `scripts/check-spec-coverage.mjs` that parses `openspec/specs/**/spec.md` scenarios and fails on missing coverage entries.
- [x] 1.5 Add backend test dependency for OpenAPI request/response validation against `contracts/openapi.yaml`.
- [x] 1.6 Add `openapi-typescript` to frontend dev dependencies and generate typed API models from `contracts/openapi.yaml`.
- [x] 1.7 Replace or reconcile `frontend/lib/types.ts` with generated contract types so frontend models cannot silently drift from backend DTOs.
- [x] 1.8 Update `docs/testing.md` with contract, traceability, shared vector, and CI test instructions.

## 2. Backend Test Coverage

- [x] 2.1 Parameterize `ScheduleEngineTest` with shared scheduling vectors from `contracts/scheduling-vectors.json`.
- [x] 2.2 Add `QueueSimulationServiceTest` covering normal queue, 2^n relearn insertion, tail fallback, and completion.
- [x] 2.3 Add `StatisticsServiceTest` covering learning/review counts, tomorrow due, retention, hourly buckets, forecast, and deleted/renamed deck history.
- [x] 2.4 Add `DueStateServiceTest` covering due state marking, timezone rollback, and refresh-time boundary behavior.
- [x] 2.5 Add auth/session unit tests for registration disabled, duplicate email, invalid invite, rate limit cleanup, remember-me, logout-all, and expired session cleanup.
- [x] 2.6 Add `ApiContractIntegrationTest` validating real controller responses against `contracts/openapi.yaml`.
- [x] 2.7 Add missing integration scenarios from the specs: registration unavailable, session truly invalid, import atomic rollback, deleted deck statistics, and forecast repeated due events.
- [x] 2.8 Add batch answer integration tests for partial conflict, in-batch idempotency, previous chain, and per-item result codes.
- [x] 2.9 Add database migration/constraint tests for Flyway validate, unique answer submission keys, soft-delete history retention, and JPA schema validation.
- [x] 2.10 Add cache invalidation tests for `StatisticsCacheService` after answer, card reset/delete, deck reset/delete/rename, and user logout.

## 3. Frontend Test Coverage

- [x] 3.1 Add Vitest jsdom environment and dev dependencies for Testing Library, user-event, jest-dom, and fake-indexeddb.
- [x] 3.2 Add `api.test.ts` covering timeout, network error, request abort, retry policy, 401 event dispatch, error-code mapping, and import size/card limits.
- [x] 3.3 Add `auth-context.test.tsx` covering cached user render, network failure retention, 401 state clearing, password/secret cache exclusion, login, register, and logout.
- [x] 3.4 Add `use-api-data.test.tsx` covering cache-first render, no-cache loading, background refresh, user cache isolation, and network failure fallback.
- [x] 3.5 Add component tests for login/register forms covering password visibility, mismatch validation, invite validation, and registration disabled state.
- [x] 3.6 Add component tests for deck list and deck detail covering create/rename/reset/delete dialogs, search, status filter, pagination, and empty/error states.
- [x] 3.7 Add component tests for card editor and import preview covering empty front rejection, editable rows, add/delete rows, file upload limits, and atomic import feedback.
- [x] 3.8 Add component tests for settings and statistics covering settings persistence, password validation, theme/language display, deleted deck options, and metric rendering.
- [x] 3.9 Add component tests for study/review flow covering front/answer state, keyboard 1/2/3, submit-in-progress guard, progress updates, graduate confirmation, and forget confirmation.
- [x] 3.10 Add Markdown/KaTeX/XSS tests verifying safe rendering, external images, long content wrapping, and script non-execution.
- [x] 3.11 Add offline IndexedDB tests for outbox persistence, session snapshot restore, batch sync, retry, conflict handling, and cache invalidation after accepted answers.
- [x] 3.12 Update `queue-mutation.test.ts` to consume shared scheduling vectors and compare expected local order with backend semantics.
- [x] 3.13 Add network-status, theme, and API cache tests covering `prefers-reduced-motion`, system theme, cache scopes, and user-scoped invalidation.

## 4. Full-Stack E2E

- [x] 4.1 Add Playwright config and helper utilities for real Next.js `:3000`, Spring Boot `:8080`, and PostgreSQL via `docker-compose.test.yml`.
- [x] 4.2 Add auth E2E covering registration, login, remember-me, logout current, logout all, and 401 redirect behavior.
- [x] 4.3 Add deck/card E2E covering create, rename, delete, reset, search, pagination, import paste/upload/edit, and history retention.
- [x] 4.4 Add study E2E covering learn and review flows, next-card transitions, reload no-duplicate behavior, graduate/confirm dialogs, and completion state.
- [x] 4.5 Add offline E2E covering snapshot load, disconnect, local scoring, refresh, reconnect, outbox sync, and server-confirmed idempotency.
- [x] 4.6 Add settings/statistics E2E covering refresh time, language, theme, password change, deleted deck filtering, and dashboard counts.
- [x] 4.7 Add responsive/accessibility E2E covering mobile layout, touch targets, keyboard focus, non-color state expression, and reduced-motion behavior.

## 5. Deployment and CI

- [x] 5.1 Add `scripts/docker-smoke.sh` to build the single image, start PostgreSQL and app, verify `:3000/api/*` proxies to `:8080`, and check health.
- [x] 5.2 Add smoke coverage for entrypoint behavior: terminating either frontend or backend process causes the container to exit.
- [x] 5.3 Extract GHCR pruning from `publish.yml` into `scripts/prune-ghcr.sh` with mocked `gh` tests for success, package not found, and release failure no-delete cases.
- [x] 5.4 Add reusable `.github/workflows/quality.yml` running contract checks, backend tests, frontend lint/test/build, E2E, and Docker smoke.
- [x] 5.5 Add `.github/workflows/ci.yml` for push/PR and modify `publish.yml` to call the same quality workflow before publishing.
- [x] 5.6 Add CI reporting for spec coverage and contract drift so a missing test mapping or generated-type mismatch fails the workflow.

## 6. Validation

- [x] 6.1 Run `openspec validate --strict` and fix planning or artifact issues.
- [x] 6.2 Run backend unit and integration tests against the test PostgreSQL database.
- [x] 6.3 Run frontend lint, generated type check, unit/component tests, and production build.
- [x] 6.4 Run Playwright E2E in the configured browser project and fix flaky or failing flows.
- [x] 6.5 Run Docker smoke and process-exit checks locally and in CI.
- [x] 6.6 Update `tests/coverage.yaml` for any scenario discovered during implementation and confirm no spec scenario is unmapped.
