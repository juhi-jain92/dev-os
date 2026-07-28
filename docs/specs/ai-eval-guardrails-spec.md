# Spec: AI Evaluation Harness & Guardrail Register

**Source:** `docs/engineering/engineering-doc.md` §8, §10, §13 (partially); PRD §7, §9, §10, §11

## Overview

This spec is cross-cutting: it defines the offline evaluation harness that gates every release, the guardrail register enforced in code across extraction and chat, the failure-handling contract shared by both OpenAI-calling Edge Functions, and the rate-limiting mechanism referenced by `upload-extraction-spec.md`, `key-term-extraction-spec.md`, and `chat-spec.md`.

## Eval Harness

### Ground truth sources (PRD §10)

- CUAD (Contract Understanding Atticus Dataset) — offline baseline
- 30 manually labelled NDA contracts + 20 manually labelled MSA contracts (legal SME annotated)
- User-corrected terms (opt-in, anonymised) — ongoing signal, sourced from `key_terms.is_edited = true` / `original_ai_value` rows

### Golden dataset schema (`eval/golden_dataset.csv`)

| Column | Type | Notes |
|---|---|---|
| `contract_id` | string | internal fixture ID, not a production `contracts.id` |
| `contract_type` | `nda`\|`msa` | |
| `term_name` | string | |
| `expected_value` | string | ground truth, SME-annotated |
| `expected_page` | int | |
| `ai_extracted_value` | string | filled in by the eval run |
| `ai_page` | int | filled in by the eval run |
| `confidence_score` | float | filled in by the eval run |
| `f1_match` | boolean | computed: exact or fuzzy match (Levenshtein ratio ≥ 0.85) between `expected_value` and `ai_extracted_value` |
| `expert_rating` | string | `correct`\|`partial`\|`incorrect`, SME-reviewed |
| `notes` | string | free text |

### Accuracy metric

Precision/Recall/F1 computed per contract type from `f1_match` across the golden dataset. A term counts as a true positive when `f1_match = true` AND `ai_page = expected_page`.

### Launch thresholds (PRD §10, §11 — hard gates, not aspirational)

| Stage | F1 gate | Other gates |
|---|---|---|
| Internal Alpha | none (functional smoke test only) | Core upload→extract→display flow works end-to-end without crashes |
| Measurement Beta | ≥ 82% F1 (either type) | Correction rate ≤ 20%; latency ≤ 45s P95; 0 incidents of a term shown without a confidence warning when confidence < 50% |
| Public Launch | ≥ 88% F1 (NDA), ≥ 85% F1 (MSA) | Correction rate ≤ 12%; calibration error ≤ 0.10; latency ≤ 30s P95 |

### Calibration check (monthly)

Bucket predicted `confidence_score` into 10%-wide bins; compare each bin's mean confidence to its observed `f1_match` rate. Calibration error = mean absolute difference across bins. If ≥ 15% miscalibration in any bin, surface a calibration warning banner in the app (a global flag read by the frontend, e.g. a `system_status` config value — not a per-term UI change).

### Chat groundedness eval (monthly)

50 Q&A pairs sampled from real contract sessions, expert-reviewed and labelled `grounded` / `hallucinated` / `not_found`. Target: ≤ 5% `hallucinated`. This is the eval that the automated CI regression test (below) provides a continuous, cheap proxy for between monthly manual reviews.

### Automated CI regression test (wired into the code test suite, not just the offline spreadsheet)

`tests/integration/chat-hallucination.test.ts`: seeds a fixture contract about an NDA with no mention of "arbitration," asks "What is the arbitration clause?", asserts the response equals (or starts with) `"I cannot find this in the document."`. This runs on every deploy per PRD's "Automated regression suite runs on every deploy" requirement.

## Guardrail Register

| Guardrail | Trigger | Enforcement point | On violation |
|---|---|---|---|
| Confidence scoring on every term | Every extraction call | `process-extraction` prompt (model self-reports) + post-parse validation clamps to `[0,100]` | Non-numeric/missing score coerced to `0`, logged |
| Low-confidence flag, never hidden | `confidence_score < 50` | `ConfidenceBadge` component (frontend) | Render ⚠️ + tooltip; term is always rendered, never filtered out |
| Source-sentence requirement | Every extraction call | Post-parse validation in `process-extraction` | Term missing `source_sentence` is dropped and logged as a data-quality event, not persisted |
| Deterministic extraction settings | Every extraction call | `process-extraction` OpenAI call params | Hardcoded `temperature: 0.1`, `response_format: json_object` — not configurable at runtime |
| JSON-mode + single retry on parse failure | Extraction or chat response fails to parse | `process-extraction` / `chat` Edge Functions | One retry with a corrective prompt; second failure → `contracts.status = 'error'` / `504` chat error |
| Document-only chat system prompt | Every chat call | `chat` Edge Function prompt template | Model instructed to say "I cannot find this in the document" when absent |
| Mandatory page citation | Every chat response | Post-response validation in `chat` Edge Function | Response missing a `[Page X]` pattern is logged as a guardrail violation (not blocked — logged for the monthly groundedness audit, since blocking a correct-but-uncited answer would itself be a UX regression) |
| Custom term cap | Custom term addition | DB trigger `check_custom_key_term_limit` + Edge Function request validation (defense in depth) | `422`/DB exception, "Maximum of 5 custom key terms per contract" |
| Contract length cap | Upload | `upload-contract` token-count check | `422 contract_too_long` |
| "Not legal advice" disclaimer | Every results-page render | `ContractHeader` component | Always rendered, non-dismissible |

## Failure Handling (shared by `process-extraction` and `chat`)

| Error class | Retryable? | Handling |
|---|---|---|
| OpenAI 5xx / network timeout | Yes | 3 attempts, exponential backoff (1s, 2s, 4s) |
| OpenAI 4xx (bad request, invalid API key) | No | Fail immediately, log as a configuration error (distinct from a transient failure), surface generic "something went wrong" to the user |
| JSON parse failure on model output | Yes (once) | Single corrective retry prompt; second failure is non-retryable |
| Rate limit exceeded (`rate_limit_events` check) | No (by design) | `429` with `retry_after_seconds`, computed as time until the oldest event in the current window expires |
| DB write failure after successful OpenAI call | No | Logged as a critical error (the OpenAI spend already happened) — surfaced as `500`; contract remains in `processing` status for manual investigation, not silently marked `error` (since the AI output existed but wasn't persisted — a distinct failure mode from an AI failure) |

**Fail-safe fallback value:** when extraction guardrails force a term to be dropped (missing source sentence) or clamped (out-of-range confidence/page), the safe outcome is to keep the term visible with a conservative confidence value (`0` if coerced) rather than to omit it — silence is never the fallback for a term the user is expecting to see, except in the single case where `source_sentence` itself is missing (then the term cannot support the "Why?" explainability requirement and is genuinely unusable).

## Rate Limiting Mechanism

Implemented via the `rate_limit_events` table (see `supabase-schema.sql`) — a lightweight sliding-window counter, avoiding a new external dependency (e.g. Redis) beyond the already-approved Supabase project.

**Algorithm (per Edge Function, per user):**
1. On each call to `process-extraction` or `chat`, count rows in `rate_limit_events` where `user_id = auth.uid()`, `function_name = <this function>`, `created_at > now() - interval '1 hour'`.
2. If count ≥ limit (20 for `process-extraction`/uploads combined, 30 for `chat`), reject with `429` and `retry_after_seconds` computed from the oldest matching row's age.
3. On success, insert a new `rate_limit_events` row.
4. A scheduled cleanup (Supabase cron or a periodic `delete from rate_limit_events where created_at < now() - interval '2 hours'`) keeps the table small — not required for correctness (the time-window query already ignores old rows) but keeps storage bounded.

## Edge Cases

- **Partial failure mid-extraction** (OpenAI call succeeds, DB write fails): see Failure Handling table — contract stays in `processing`, flagged for manual/ops investigation rather than silently marked `error` (which would incorrectly signal "AI failed" when it didn't).
- **Concurrent extraction + chat requests for the same contract:** independent operations on independent tables (`key_terms` vs `chat_messages`); no locking needed.
- **Ask-vs-guess-vs-skip for ambiguous custom terms** (e.g. user types a custom term that doesn't clearly map to any clause): the model is instructed to return `"Not found in document"` with `confidence_score: 0` rather than guessing a plausible-sounding value — this is the same "skip with a labelled low-confidence result" pattern used for standard terms, not a special case.
- **Golden dataset drift** (contracts eval'd against become stale as prompts change): the eval harness re-runs the full golden dataset on every prompt version bump, not incrementally, to avoid comparing apples to oranges across prompt versions.
