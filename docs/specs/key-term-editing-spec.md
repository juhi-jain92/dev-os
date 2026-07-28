# Spec: Inline Key Term Editing

**Source:** `docs/engineering/engineering-doc.md` §4 (Flow 3.4), §9 (FR-09 correction); PRD US-009

## Overview

Users can correct any extracted term's value inline. The original AI value is preserved (never overwritten) so it can feed the correction-rate feedback loop described in `ai-eval-guardrails-spec.md`.

## User Flow

1. On the results page, user clicks a term's value to enter edit mode.
2. An inline text input replaces the value display, pre-filled with the current value.
3. User edits and confirms (Enter or blur triggers save; Escape cancels without saving).
4. Frontend optimistically updates the row and shows an "Edited" badge; the mutation saves to Supabase.
5. On success, the row shows the new value with the "Edited" badge persisted. On failure, the row reverts and shows an inline error.

## Data Model

Uses `key_terms.value`, `key_terms.original_ai_value`, `key_terms.is_edited` (and the equivalent columns on `custom_key_terms`) — see `supabase-schema.sql`. No new tables.

## DB Tasks

None beyond `supabase-schema.sql`. Note: `original_ai_value` is set exactly once — on the *first* edit only. A term edited a second time keeps its original AI value, not the intermediate edited value (this must be enforced in the Edge Function logic, not assumed from client input).

## API Contract

### `PATCH /functions/v1/key-terms/:id`

- **Auth:** required; caller must own the parent contract (checked via a join on `key_terms.user_id = auth.uid()`)
- **Request:**
  ```json
  { "value": "36 months from the Effective Date" }
  ```
- **Response 200:**
  ```json
  { "id": "uuid", "value": "36 months from the Effective Date", "is_edited": true, "original_ai_value": "12 months" }
  ```
- **Server logic:**
  1. Load the current row.
  2. If `is_edited = false`: set `original_ai_value = <current value>`, `value = <new value>`, `is_edited = true`.
  3. If `is_edited = true` already: only update `value`; leave `original_ai_value` untouched.
- **Validation:** `value` must be non-empty, ≤ 2,000 chars → else `422 { "error": "invalid_value" }`
- **Errors:** `401`, `404 { "error": "term_not_found" }`, `422`

### `PATCH /functions/v1/custom-key-terms/:id`

Identical contract, targeting the `custom_key_terms` table.

## State Management (Frontend)

- `useUpdateKeyTerm(termId)` — TanStack Query mutation with optimistic update: `onMutate` writes the new value into the `['key-terms', contractId]` cache immediately; `onError` rolls back to the previous cache snapshot; `onSettled` invalidates to reconcile with the server.
- Edit-mode toggle is local component state (`useState<boolean>`) per row — not global.

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `KeyTermRow` (extended) | `components/results/KeyTermRow.tsx` | Adds click-to-edit on the value cell, renders `InlineEditField` when in edit mode, renders an "Edited" badge when `is_edited = true` |
| `InlineEditField` | `components/results/InlineEditField.tsx` | Client component; controlled text input, Enter-to-save / Escape-to-cancel, calls the mutation on blur |

## Design

"Edited" badge follows the Semantic Status Badge pattern in `Blue 50`/`Blue 200`/`Blue 700` (distinguishing "user-modified" from the Green/Yellow/Red confidence signal, which remains visible alongside it). Inline edit field: `Radius-MD (6px)` border in `Blue 500` while focused (per the design system's Focus state), same typography as the display value (`Paragraph Large Medium`) so the layout doesn't shift on edit.

## Edge Cases

- **Save within 2 seconds (PRD US-009 acceptance criteria):** the mutation is a single small `PATCH` against an indexed row — no batching or debouncing needed to hit this target.
- **User clears the field and blurs:** treated as an empty value, rejected client-side before the network call ("Value cannot be empty"); edit field stays open for correction.
- **Concurrent edit from two tabs:** last write wins (no optimistic-concurrency version check at MVP — out of scope; single-user-per-contract usage pattern makes this a low-probability, low-impact edge case).
- **Editing a term that was already low-confidence:** the ⚠️ warning and confidence badge remain visible and unchanged after a manual edit — editing the value does not change `confidence_score` (that field reflects the AI's original certainty, not the corrected value's accuracy).
- **Network failure during save:** optimistic update rolls back, row shows a small inline "Couldn't save — try again" affordance next to the value, re-entering edit mode on click.
