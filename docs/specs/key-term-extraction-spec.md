# Spec: Key Term Extraction (AI)

**Source:** `docs/engineering/engineering-doc.md` §4 (Flow 3.2), §8, §9; PRD §7–9

## Overview

The `process-extraction` Edge Function is the core AI component: it takes the stored `contract_text`, the contract type, and up to 5 custom terms, calls GLM-4.7-Flash (via Z.ai) in JSON mode with a few-shot prompt, validates and persists the structured output. This is the highest-risk component in the system (PRD Risk Level: Medium) — guardrails are non-negotiable, not optional polish.

## User Flow

1. User has completed the pre-processing preview (see `upload-extraction-spec.md`) and optionally added up to 5 custom terms.
2. User clicks "Process Contract" — frontend shows a 3-step progress indicator (extracting text [already done] → analysing with AI → compiling results).
3. Frontend calls `POST /functions/v1/process-extraction`.
4. Edge Function builds the prompt, calls GLM, parses the JSON response, validates every field, writes rows to `key_terms` and `custom_key_terms`, updates `contracts.status`.
5. Frontend redirects to `/contracts/[id]` on success.

## Per-Component AI Contract

| Property | Value |
|---|---|
| Provider | GLM-4.7-Flash via Z.ai (`https://api.z.ai/api/paas/v4/chat/completions`, `thinking: { type: "disabled" }`) |
| Model | `glm-4.7-flash` |
| Response format | `{ "type": "json_object" }` |
| Temperature | `0.1` |
| Max output tokens | `2000` |
| Input | System prompt (few-shot: 3 NDA examples + 3 MSA examples, standard term schema for the selected type, injected custom terms) + user message containing `contract_text` |
| Output schema (per term) | `{ "term_name": string, "value": string, "page_number": integer, "confidence_score": number (0.0–100.0), "source_sentence": string }` |
| Output shape | JSON object with a single key `"terms"`: `{ "terms": [ {...}, {...} ] }` — using a named top-level key (not a bare array) because JSON mode requires a JSON *object*, not a top-level array |

### System prompt template (`lib/openai/prompts/extraction-nda.ts` / `extraction-msa.ts`)

```
You are a contract analysis assistant. Extract the following key terms from the
provided {NDA|MSA} contract text. The text contains [PAGE N] markers indicating
page boundaries — use these to determine the page_number for each term.

Standard terms to extract: {standard_term_list}
Additional custom terms requested by the user: {custom_term_list}

For each term, return:
- term_name: the term as listed above
- value: the extracted value, verbatim or concisely paraphrased
- page_number: the 1-indexed page where this term appears (from [PAGE N] markers)
- confidence_score: your confidence this extraction is correct, 0.0-100.0
- source_sentence: the exact verbatim sentence from the contract this value was drawn from

If a term is not present in the document, still include it with value:
"Not found in document", confidence_score: 0, source_sentence: "".

Return ONLY a JSON object: { "terms": [ ... ] }. No prose, no markdown fences.

[3 few-shot examples follow, each a full input/output pair for a real NDA/MSA excerpt]
```

### Retry / error recovery

1. Call GLM. If the response is not valid JSON, or `terms` is missing/not an array, send exactly one retry with the message: `"Your previous response was not valid JSON. Return only the JSON object { \"terms\": [...] }, no explanation."` appended to the conversation.
2. If the retry also fails validation, set `contracts.status = 'error'` and return `502 { "error": "extraction_failed", "message": "We couldn't analyse this contract. Please try again in a few minutes." }`.
3. Any GLM network/5xx error triggers the standard 3-attempt exponential backoff (1s, 2s, 4s) before falling into the same error path.

### Post-parse validation (defense in depth — never trust the model's output shape blindly)

- Every term object must have all 5 required fields; drop and log (do not persist) any term missing `term_name` or `source_sentence`.
- `confidence_score` clamped to `[0, 100]`; non-numeric values coerced to `0` and logged as a data-quality signal.
- `page_number` clamped to `[1, contracts.page_count]`; out-of-range values are logged and clamped rather than rejecting the whole response (PRD: never silently drop a term the user is expecting to see).
- Standard terms are written to `key_terms`; terms matching a name in the injected custom-term list are written to `custom_key_terms` with `is_manual = true`.

## Data Model

Uses `key_terms` and `custom_key_terms` tables (see `supabase-schema.sql`). No new tables.

## DB Tasks

- None beyond `supabase-schema.sql`. The `check_custom_key_term_limit` trigger already enforces ≤5 custom terms at the DB layer, independent of the ≤5 check the Edge Function performs on the request body.

## API Contract

### `POST /functions/v1/process-extraction`

- **Auth:** required; caller must own `contract_id`
- **Request:**
  ```json
  { "contract_id": "uuid", "custom_terms": ["Non-compete radius", "Data residency"] }
  ```
  `custom_terms` is optional, max length 5, each string max 100 chars.
- **Response 200:**
  ```json
  { "contract_id": "uuid", "status": "processed", "term_count": 14 }
  ```
- **Validation rules:**
  1. `contract_id` must belong to the authenticated user and have `status = 'text_extracted'` → else `404 { "error": "contract_not_found" }` or `409 { "error": "already_processed" }`
  2. `custom_terms.length <= 5` → else `422 { "error": "too_many_custom_terms", "max": 5 }`
  3. Rate limit: ≤ 20 extractions per user per rolling hour → else `429 { "error": "rate_limited", "retry_after_seconds": <n> }`
- **Error responses:** `401`, `404`, `409`, `422`, `429`, `502 { "error": "extraction_failed" }` (sets `contracts.status = 'error'`, does not throw away the already-stored `contract_text` — user can retry without re-uploading)

## State Management (Frontend)

- Triggered as a TanStack Query mutation (`useProcessExtraction`); on success, invalidates `['contract', contractId]` and `['key-terms', contractId]` so the results page fetches fresh data.
- 3-step progress indicator is local component state driven by elapsed time heuristics (step 1 complete on mount, step 2 while the mutation is pending, step 3 for ~500ms after success before navigating) — there is no server-sent progress channel at MVP.

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `ProcessButton` | `components/upload/ProcessButton.tsx` | Client component; triggers the mutation, disables itself and shows the progress indicator while pending |
| `ExtractionProgressIndicator` | `components/upload/ExtractionProgressIndicator.tsx` | 3-step visual (extracting → analysing → compiling) |

## Design

Progress indicator uses 3 horizontally-arranged steps, each a filled `Blue 500` circle when active/complete and `Grey 200` when pending, connected by a 2px line, per the design system's flat-depth/no-gradient principle.

## Edge Cases

- **Extraction yields 0 terms** (e.g. non-contract document like an invoice): per PRD, still store whatever was extracted; most/all terms will show low confidence with the ⚠️ warning rather than blocking the user — this is intended behaviour, not a failure.
- **User uploads a document type mismatched with the selected contract_type** (e.g. selects "MSA" but uploads an NDA): no server-side detection at MVP; the standard-term schema for the selected type is still used, producing mostly "Not found in document" values with confidence 0 — surfaced to the user exactly like any other low-confidence result (soft failure, per PRD Internal Risks table).
- **Double-submit** (user double-clicks "Process Contract"): `ProcessButton` disables on first click; the `409 already_processed` guard on the server is the authoritative safeguard against a race from multiple tabs.
- **GLM call exceeds 20s:** covered by the standard retry/backoff path in `ai-eval-guardrails-spec.md`'s failure-handling table; from the user's perspective this manifests as a longer wait on step 2, capped by the overall Edge Function timeout.
