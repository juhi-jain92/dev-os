# Spec: Dashboard & Contract History

**Source:** `docs/engineering/engineering-doc.md` §4 (Flow 2, derived flow), §9 (FR-10); PRD US-008

## Overview

The dashboard is a read-only view over the user's own `contracts`: a summary card and a sortable history table. No AI or Edge Function involvement — direct RLS-scoped Supabase queries only.

## User Flow

1. User signs in and lands on `/dashboard`.
2. **Empty state** (no contracts yet): "No contracts reviewed yet — upload your first contract to begin" with a prominent "Review a Contract" CTA.
3. **Populated state:** summary card shows total contracts processed and a breakdown by type (NDA/MSA count); below it, a sortable table of the last 5 contracts (with a "View all" affordance if more exist, deferred UI — MVP shows the 5 most recent inline, full pagination is not required by the PRD).
4. Clicking a column header (Date / Name / Type) re-sorts the table.
5. Clicking any row navigates to `/contracts/[id]`.

## Data Model

Reads from `contracts` (see `supabase-schema.sql`). No new tables or columns.

## DB Tasks

None beyond `supabase-schema.sql`. The existing `idx_contracts_user_created` index on `(user_id, created_at desc)` covers the default sort; sorting by `file_name` or `contract_type` falls back to an unindexed sort, acceptable at MVP scale (PRD: 100 concurrent analyses, not per-user row counts in the thousands).

## API Contract

### `GET /rest/v1/contracts?select=id,file_name,contract_type,status,created_at&order=created_at.desc`
(Direct Supabase client query, RLS-scoped)

- **Auth:** required
- **Query params:** `order` (`created_at.desc` default, or `file_name.asc`, `contract_type.asc`)
- **Response 200:** array of contract summary rows for `auth.uid()`

### Summary counts

Computed client-side from the same fetched array (`contracts.length`, grouped by `contract_type`) rather than a separate aggregate query — at MVP scale this avoids an extra round-trip with no meaningful performance cost.

## State Management (Frontend)

- `useContracts(sortOrder)` — TanStack Query hook, query key `['contracts', userId, sortOrder]`.
- Sort order is local component state (`useState`) reflected in the query key so changing sort triggers a refetch with the new `order` param (no client-side re-sort of already-fetched data, to keep behavior consistent if pagination is added later in v1.1).

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `DashboardPage` | `app/dashboard/page.tsx` | Server component shell; renders `SummaryCard` + `ContractHistoryTable` (client) |
| `SummaryCard` | `components/dashboard/SummaryCard.tsx` | Total count + NDA/MSA breakdown |
| `ContractHistoryTable` | `components/dashboard/ContractHistoryTable.tsx` | Client component; sortable headers, row click navigation |
| `EmptyDashboardState` | `components/dashboard/EmptyDashboardState.tsx` | Rendered when `contracts.length === 0` |

## Design

Summary card: white surface, `Radius-LG (8px)`, per the design system's "elevated surface" rule (white on `Grey 25` page background). Table rows: `Grey 100` divider borders, hover state `Grey 50` background per the documented State Colors table. Status indicator per row (`processed`/`processing`/`error`) reuses the Semantic Status Badge pattern: `processed` → Green, `processing` → Blue, `error` → Red.

## Edge Cases

- **Contract stuck in `status = 'processing'`** (e.g. Edge Function crashed mid-call without reaching the error path): displays as a "Processing" badge indefinitely — out of scope to auto-detect and reset at MVP; a manual re-upload is the user's recovery path. Flagged here as a known gap, not solved by this spec.
- **Contract with `status = 'error'`:** row shows an "Error" badge; clicking through to `/contracts/[id]` shows a "Try again" CTA that re-invokes `process-extraction` (contract_text is already stored, so no re-upload is needed).
- **Sorting by a column with ties** (e.g. two contracts uploaded in the same second): stable secondary sort by `id` to avoid row-order flicker between requests.
