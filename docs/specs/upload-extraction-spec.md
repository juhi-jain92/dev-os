# Spec: PDF Upload & Text Extraction

**Source:** `docs/engineering/engineering-doc.md` §4 (Flow 3.1), §6, §7, §9

## Overview

The `upload-contract` Edge Function accepts a PDF, validates it against MVP limits, extracts text with page markers, persists the text as the single source of truth, and asynchronously (non-blocking) uploads the raw PDF to Storage for the inline viewer.

## User Flow

1. User selects contract type (NDA/MSA) on `/upload`, then drags/drops or file-picks a PDF.
2. Frontend validates client-side: file type is `application/pdf`, size ≤ 10 MB. Reject immediately with a clear message if not (no network call made).
3. Frontend uploads the file to `upload-contract` with an upload progress bar.
4. Edge Function: parses the PDF with `pdf-parse`, counts pages (reject if > 20), inserts `[PAGE N]` markers between page boundaries, counts words (reject if < 100 → "Scanned PDFs are not supported yet"), counts tokens (reject if > 15,000 tokens using a tokenizer estimate).
5. On success: insert `contracts` row (`status = 'text_extracted'`), return `{ contract_id, status, page_count }` to the client immediately.
6. Asynchronously (fire-and-forget within the same function invocation, after the DB insert): upload the original PDF bytes to Storage at `contracts/{user_id}/{contract_id}/{filename}.pdf`. On failure, log the error and leave `contracts.file_path = null` — this never blocks or fails the response already sent to the client.
7. Frontend shows the pre-processing preview card (standard term list for the selected contract type, sourced from a static config — see Component Spec) and offers "+ Add Key Term".

## Data Model

Uses `contracts` table (see `supabase-schema.sql`). No new tables. `page_count` check constraint (`> 0 and <= 20`) enforces the page limit at the DB layer as a second line of defense.

## DB Tasks

- None beyond `supabase-schema.sql`. Ensure the `contracts` Storage bucket and its 3 RLS policies (insert/select/delete) are present before first upload — omitting them causes `file_path` to silently stay null for every contract (acceptable — the text-viewer fallback still works — but the PDF viewer never renders).

## API Contract

### `POST /functions/v1/upload-contract`

- **Auth:** required (`Authorization: Bearer <jwt>`)
- **Request:** `multipart/form-data`
  - `file`: PDF binary
  - `contract_type`: `"nda" | "msa"`
- **Response 200:**
  ```json
  { "contract_id": "uuid", "status": "text_extracted", "page_count": 12 }
  ```
- **Validation rules (checked in this order, fail fast):**
  1. `contract_type` must be `"nda"` or `"msa"` → else `400 { "error": "invalid_contract_type" }`
  2. File must be `application/pdf` → else `400 { "error": "invalid_file_type" }`
  3. File size ≤ 10 MB → else `413 { "error": "file_too_large", "max_mb": 10 }`
  4. Page count ≤ 20 → else `422 { "error": "too_many_pages", "max_pages": 20, "actual_pages": <n> }`
  5. Extracted word count ≥ 100 → else `422 { "error": "scanned_pdf_unsupported", "message": "Scanned PDFs are not supported yet" }`
  6. Estimated token count ≤ 15,000 → else `422 { "error": "contract_too_long", "max_tokens": 15000 }`
  7. Rate limit: ≤ 20 uploads per user per hour (via `rate_limit_events`, `function_name = 'process-extraction'` shared budget — see `ai-eval-guardrails-spec.md`) → else `429 { "error": "rate_limited", "retry_after_seconds": <n> }`
- **Error responses:** `400`, `413`, `422`, `429`, `500 { "error": "extraction_failed" }` (unexpected `pdf-parse` failure — no partial `contracts` row is left behind; the insert only happens after successful parsing)

## State Management (Frontend)

- Upload progress is local component state (`useState<'idle'|'uploading'|'validating'|'done'|'error'>`), not TanStack Query (this is a one-shot mutation, not cached server state).
- On success, `queryClient.invalidateQueries(['contracts', userId])` so the dashboard list picks up the new contract next time it's viewed.
- The returned `contract_id` is pushed into local state to drive the next step (custom term addition, then `POST /functions/v1/process-extraction` — see `key-term-extraction-spec.md`).

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `ContractTypeSelect` | `components/upload/ContractTypeSelect.tsx` | Dropdown, NDA/MSA, controls which static term schema is shown in the preview |
| `FileDropzone` | `components/upload/FileDropzone.tsx` | Client component; drag-drop + file-picker; client-side size/type validation before calling the upload mutation |
| `KeyTermPreviewCard` | `components/upload/KeyTermPreviewCard.tsx` | Renders the standard term list for the selected type from `lib/config/standard-terms.ts`; renders any added custom terms with a "Custom" badge |
| `standard-terms.ts` | `lib/config/standard-terms.ts` | Static config: NDA → `["Parties","Effective Date","Confidentiality Obligations","Permitted Disclosures","Term & Duration","Governing Law","Jurisdiction","IP Ownership","Non-Solicitation","Breach & Remedy"]`; MSA → `["Parties","Service Scope","Payment Terms","Invoice Schedule","Late Payment Penalty","Liability Cap","Indemnification","IP Ownership","Termination Clause","Governing Law","Dispute Resolution","Notice Period"]` |

## Design

Dropzone uses `Radius-LG (8px)` dashed border in `Grey 200`, background `Grey 25`; on drag-over, border becomes `Blue 500` per the design system's Focus state color. Progress bar uses `Blue 500` fill on `Grey 50` track. Preview card term rows follow the "Labeled Value Row" pattern from `docs/design.md` (16px Medium term name, 12px Regular "Custom" badge tag using the Yellow 50/200/700 badge pattern).

## Edge Cases

- **Non-PDF file dropped:** rejected client-side before any network call, message: "Only PDF files are supported."
- **File exceeds 10 MB:** rejected client-side (no upload attempt) with the same message the server would return, so the user never waits on a network round-trip for an obviously invalid file.
- **Contract exceeds 20 pages or 15,000 tokens:** server-side rejection with the specific limit named; the `contracts` row is never created (extraction happens in-memory before any insert).
- **Scanned/image PDF:** detected via word-count heuristic (< 100 words extracted); user sees "Scanned PDFs are not supported yet" with no retry path other than uploading a different file — OCR is deferred to v1.2 (`engineering-doc.md` §2 Future Enhancements).
- **Storage upload fails after successful text extraction:** `contracts.file_path` stays `null`; the response to the client already succeeded (extraction, not Storage, is the source of truth); results page automatically falls back to the text viewer (see `results-viewer-spec.md`) — no user-facing error for this case.
- **Concurrent uploads by the same user:** each upload is an independent `contracts` row; no locking needed. Rate limiting caps abuse, not legitimate concurrent use.
- **Duplicate re-upload of the same contract:** treated as a new, independent `contracts` row — no dedup logic at MVP (out of scope; PRD does not require it).
