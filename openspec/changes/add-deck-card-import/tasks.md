## 1. Backend Configuration and DTOs

- [ ] 1.1 Add `karisanki.import.max-source-bytes` and `karisanki.import.max-cards` to `AppProperties` with defaults of `2MB` and `5000`
- [ ] 1.2 Add parse/import DTO records to `CardDtos`: parse request, preview item, preview response, import request, import response
- [ ] 1.3 Add `invalid_import_json`, `import_source_too_large`, `too_many_import_cards`, and `back_invalid` business error handling paths

## 2. Backend JSON Parse

- [ ] 2.1 Implement parse service logic that validates source size, parses raw JSON, and rejects non-array roots
- [ ] 2.2 Normalize each object row: trim `front`, convert missing/blank `back` to empty string, collect per-row errors, and ignore unknown fields
- [ ] 2.3 Load active card content projections for the deck and mark rows whose normalized `front` + `back` already exists
- [ ] 2.4 Return preview items plus `total`, `validCount`, `duplicateCount`, and `invalidCount`, and reject card counts above the configured limit

## 3. Backend Bulk Import

- [ ] 3.1 Add a repository query that returns only active card `front`/`back` values for a deck owned by the user
- [ ] 3.2 Implement `CardService.importCards` that validates every row, rechecks duplicates, assigns sequential positions after the current max, and creates `Card` + `CardState` records
- [ ] 3.3 Make the import method transactional so any invalid row or persistence failure rolls back the whole batch
- [ ] 3.4 Add `POST /api/decks/{deckId}/cards/parse` and `POST /api/decks/{deckId}/cards/import` endpoints in `CardController` with user/deck ownership checks
- [ ] 3.5 Return `created` and `skippedDuplicates` from the import endpoint

## 4. Backend Tests

- [ ] 4.1 Add integration tests for successful parse, invalid JSON, non-array roots, and per-row invalid front/back handling
- [ ] 4.2 Add integration tests for import success, existing-card dedupe, source order preservation, and new-card state
- [ ] 4.3 Add integration tests proving an invalid row rejects the entire batch with no cards created
- [ ] 4.4 Add integration tests for cross-user deck access isolation on parse and import
- [ ] 4.5 Add integration tests for source size and card count limits
- [ ] 4.6 Run `cd backend && ./mvnw test`

## 5. Frontend Types, API, and Copy

- [ ] 5.1 Add `ImportPreviewItem`, `ImportPreview`, and `ImportResult` types to `lib/types.ts`
- [ ] 5.2 Add import error messages to `lib/api.ts` and UI copy to `lib/i18n.tsx` for both ZH and EN
- [ ] 5.3 Add client-side source size and card count limits aligned with the backend defaults

## 6. Frontend Import Panel

- [ ] 6.1 Create an `ImportCards` component with paste JSON textarea and `.json` file upload that fills the same source input
- [ ] 6.2 Implement the parse request, loading/error states, and a summary showing valid, duplicate, and invalid rows
- [ ] 6.3 Render an editable preview list where each row has front/back textareas, row errors, duplicate status, and delete action
- [ ] 6.4 Support adding an empty row and update each row's client-side validity as content changes
- [ ] 6.5 Implement the import request using edited rows, show created/skipped counts, and call `onImported` to close and reload
- [ ] 6.6 Wire the import button into the deck detail page header using a `Sheet` panel and preserve existing page loading/filter behavior

## 7. Configuration Documentation

- [ ] 7.1 Add `KARISANKI_IMPORT_MAX_SOURCE_BYTES` and `KARISANKI_IMPORT_MAX_CARDS` to `.env.example`
- [ ] 7.2 Document the two new variables in `docs/environment-variables.md`

## 8. Final Verification

- [ ] 8.1 Run `cd frontend && npm run lint`
- [ ] 8.2 Run `cd frontend && npm run build`
- [ ] 8.3 Run `openspec validate --change add-deck-card-import`
