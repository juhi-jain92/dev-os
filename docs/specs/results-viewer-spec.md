# Spec: Results Display — PDF Viewer, Text Viewer Fallback, Key Terms Panel

**Source:** `docs/engineering/engineering-doc.md` §4 (Flow 3.3, 3.5, 3.8, 3.9), §5, §9 (FR-04, FR-06, FR-07, FR-11)

## Overview

The results page (`/contracts/[id]`) is a two-panel layout: a document panel (PDF.js viewer, or a text-viewer fallback when Storage is unavailable) and a key terms panel. Both document viewers respond to the same `targetPage` prop so key-term clicks always navigate correctly regardless of which viewer is active.

## User Flow

1. User lands on `/contracts/[id]` after processing (or by clicking a dashboard row).
2. Frontend fetches the contract (including `file_path`, `contract_text`) plus its `key_terms` and `custom_key_terms` in one query.
3. If `file_path` is non-null: request a 1-hour signed URL from Supabase Storage and render `PdfViewer`. If `file_path` is null, or the signed-URL request fails, render `TextViewer` instead — same page, no error shown to the user (this is expected, documented fallback behavior, not a fault).
4. Key terms panel renders one row per term: name, value, page number (clickable), confidence badge (colour-coded), and an expandable "Why?" showing `source_sentence`.
5. Clicking a page number sets `targetPage`, which both viewers consume to scroll/highlight.
6. Terms with `confidence_score < 50` render a ⚠️ icon and a non-dismissible tooltip; the PDF viewer auto-highlights the nearest matching page span for that term when its row is focused/hovered.
7. A "Not legal advice" disclaimer banner is always visible above the fold.

## Data Model

Reads from `contracts`, `key_terms`, `custom_key_terms` (see `supabase-schema.sql`). No writes happen from this spec (editing is `key-term-editing-spec.md`).

## DB Tasks

None — read-only against existing schema.

## API Contract

### `GET /rest/v1/contracts?id=eq.:id&select=*,key_terms(*),custom_key_terms(*)`
(Direct Supabase client query, RLS-scoped — no custom Edge Function needed)

- **Auth:** required
- **Response 200:** single contract row with nested `key_terms` and `custom_key_terms` arrays
- **Errors:** RLS returns an empty result set (not a 403) if the contract belongs to another user — frontend treats an empty result as `404`

### Signed URL for PDF viewer

- **Call:** `supabase.storage.from('contracts').createSignedUrl(file_path, 3600)` (1-hour expiry per PRD constraint)
- Only attempted when `contracts.file_path is not null`; failure is caught and silently triggers the text-viewer fallback.

## State Management (Frontend)

- `useContract(contractId)` — TanStack Query hook wrapping the query above; query key `['contract', contractId]`.
- `targetPage` — local state (`useState<number>`) owned by the results page shell, passed down to both `PdfViewer` and `TextViewer` and updated by `KeyTermRow` click handlers.
- Signed URL fetch is a derived TanStack Query (`useSignedPdfUrl(filePath)`, enabled only when `filePath` is truthy) so it's cached and doesn't re-fetch on every render.

## Component Spec

```
ContractResultsPage
├── ContractHeader           — name, type, "Not legal advice" disclaimer banner
├── ResultsLayout            — two-panel, collapses to tabs below 768px
│   ├── DocumentPanel
│   │   ├── PdfViewer        — renders when signed URL resolves; PDF.js, scroll/zoom, targetPage-driven navigation
│   │   └── TextViewer       — renders [PAGE N]-delimited sections from contract_text; same targetPage contract
│   └── KeyTermsPanel
│       ├── KeyTermRow (×N)  — name | value | PageLink | ConfidenceBadge | WhyExpandable
│       └── (edit affordance — see key-term-editing-spec.md)
```

| Component | File | Responsibility |
|---|---|---|
| `PdfViewer` | `components/results/PdfViewer.tsx` | Client component; wraps `pdfjs-dist`; exposes `scrollToPage(targetPage)`; lazy-loads pages for performance |
| `TextViewer` | `components/results/TextViewer.tsx` | Client component; splits `contract_text` on `[PAGE N]` markers via `lib/pdf/parse-markers.ts`, renders each page as a labelled `<section id="page-N">`; scrolls to `#page-{targetPage}` on prop change |
| `KeyTermsPanel` | `components/results/KeyTermsPanel.tsx` | Merges `key_terms` + `custom_key_terms`, sorts by page number |
| `KeyTermRow` | `components/results/KeyTermRow.tsx` | Single term row; triggers `onPageClick(page_number)` |
| `ConfidenceBadge` | `components/results/ConfidenceBadge.tsx` | Colour-codes by threshold (see Design) |
| `WhyExpandable` | `components/results/WhyExpandable.tsx` | Collapsible showing verbatim `source_sentence` |
| `parse-markers.ts` | `lib/pdf/parse-markers.ts` | Shared utility: `parsePageMarkers(text: string): { page: number; content: string }[]` — used by both `TextViewer` and the extraction prompt builder |

## Design

Per `docs/design.md`'s Semantic Status Badge pattern:

| Confidence | Badge background | Badge border | Badge text |
|---|---|---|---|
| ≥ 80% | Green 50 | Green 200 | Green 700 |
| 50–79% | Yellow 50 | Yellow 200 | Yellow 700 |
| < 50% | Red 50 | Red 200 | Red 700 |

Badge: `Radius-SM (4px)`, `padding: 2px 8px`, `Paragraph Small Medium` text. Low-confidence rows additionally render a ⚠️ icon (not colour alone — accessibility rule: colour is never the sole signal). Panel layout follows the Section Block pattern (H5 Medium section title, 24px gap, then content). Disclaimer banner: `Yellow 50` background, `Yellow 500` left border accent, `Paragraph Large Medium` text in `Grey 900`.

## Edge Cases

- **`file_path` is null:** text-viewer renders automatically; no error banner (documented fallback, PRD FR-06).
- **Signed URL request fails** (Storage outage): same fallback as above, logged but not surfaced to the user.
- **PDF has unusual fonts/layout that PDF.js can't render:** provide a "Download PDF" link (using the same signed URL) as an escape hatch, per PRD external-dependency mitigation.
- **`page_number` on a term exceeds `contracts.page_count`:** already clamped server-side at extraction time (see `key-term-extraction-spec.md`); the viewer never receives an out-of-range `targetPage`.
- **Zero key terms extracted:** panel shows all terms in the "Not found in document" state with 0% confidence rather than an empty panel — this is the expected shape of a bad-extraction outcome, not a UI empty state.
- **Very long `source_sentence`:** `WhyExpandable` truncates the collapsed preview to ~120 characters with an ellipsis; the expanded state shows the full sentence.
