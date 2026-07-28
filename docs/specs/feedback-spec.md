# Spec: Feedback Collection

**Source:** `docs/engineering/engineering-doc.md` §4 (derived flow), §9 (FR-12); PRD US-010

## Overview

A simple thumbs up/down + optional comment on the results page, feeding the correction-rate/feedback improvement loop referenced in the PRD's MOAT section. No AI involvement.

## User Flow

1. On the results page, user clicks 👍 or 👎.
2. An optional comment field appears (collapsed by default, expands on click "Add a comment").
3. User submits — feedback is saved, widget becomes read-only for that session (one feedback submission per contract per session; re-visiting the page still shows the submitted state).

## Data Model

Uses `user_feedback` (see `supabase-schema.sql`). No new tables.

## DB Tasks

None beyond `supabase-schema.sql`.

## API Contract

### `POST /functions/v1/submit-feedback`

- **Auth:** required; caller must own `contract_id`
- **Request:**
  ```json
  { "contract_id": "uuid", "rating": "up", "comment": "Missed the indemnification cap on page 4" }
  ```
  `comment` is optional, max 1,000 chars.
- **Response 200:** `{ "id": "uuid" }`
- **Validation:** `rating` must be `"up"` or `"down"` → else `422 { "error": "invalid_rating" }`; `contract_id` must belong to caller → else `404`
- **Errors:** `401`, `404`, `422`

## State Management (Frontend)

- `useSubmitFeedback(contractId)` — TanStack Query mutation; on success, sets local component state to a "submitted" flag so the widget renders read-only without needing a dedicated GET (the mutation response is sufficient — no need to query `user_feedback` back).

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `FeedbackWidget` | `components/results/FeedbackWidget.tsx` | Thumbs up/down buttons, expandable comment field, submit button, read-only post-submit state |

## Design

Thumbs buttons: ghost style by default (`Grey 400` icon, transparent background), selected state fills with `Blue 500` (up) — the PRD does not call for red/green semantic coloring here since this is a UI preference signal, not a status/state indicator. Comment field: standard input styling (`Radius-MD`, `Grey 100` border).

## Edge Cases

- **User submits feedback, then reloads the page:** MVP re-renders the widget in its default (non-submitted) state — no query-back to check prior submission, since the PRD only requires "a" feedback submission per review session, not idempotent single-submission enforcement across reloads. (If stricter one-per-contract enforcement is wanted later, add a unique constraint on `(contract_id, user_id)` and a existence check — not required by the current PRD acceptance criteria.)
- **Comment left empty with a rating selected:** valid — `comment` is optional; only `rating` is required.
- **Very long comment:** rejected client-side at 1,000 chars with a live character counter.
