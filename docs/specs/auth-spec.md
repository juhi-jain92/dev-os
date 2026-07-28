# Spec: Authentication

**Source:** `docs/engineering/engineering-doc.md` §3, §4 (Flow 1–2), §5

## Overview

Email/password authentication via Supabase Auth. No custom `profiles` table is needed at MVP — `auth.users.id` is used directly as the `user_id` FK on every domain table. There is a single user role; no admin/reviewer roles exist.

## User Flow

1. **Sign up:** Landing page → "Get Started Free" → sign-up form (email, password, confirm password) → Supabase Auth creates the user and sends a verification email → user redirected to `/dashboard`, rendered with the empty state.
2. **Sign in:** `/sign-in` → email + password → Supabase Auth verifies credentials, returns a session → redirect to `/dashboard`.
3. **Sign out:** Any authenticated page → "Sign out" control in the nav → `supabase.auth.signOut()` → redirect to `/`.
4. **Session persistence:** Supabase session stored via `@supabase/ssr` cookie adapter so server components and Edge Functions can read the authenticated user without a client round-trip.

## Data Model

Uses Supabase's built-in `auth.users` table. No additional schema required. Every domain table (see `supabase-schema.sql`) has `user_id uuid references auth.users(id)`.

## DB Tasks

- None beyond `supabase-schema.sql` (RLS policies on all domain tables already reference `auth.uid()`).
- In the Supabase dashboard: enable "Email" provider under Authentication > Providers (enabled by default); set the Site URL and Redirect URLs to `NEXT_PUBLIC_SITE_URL` under Authentication > URL Configuration so verification emails redirect correctly.

## API / Client Calls

All auth operations use the Supabase JS client directly from the frontend — no custom Edge Function is needed.

| Action | Call |
|---|---|
| Sign up | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${NEXT_PUBLIC_SITE_URL}/dashboard` } })` |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` |
| Sign out | `supabase.auth.signOut()` |
| Get session (server component) | `createServerClient(...).auth.getSession()` via `lib/supabase/server.ts` |

Every Edge Function validates the `Authorization: Bearer <jwt>` header using `supabase.auth.getUser(jwt)` before performing any DB or OpenAI operation. Requests with a missing/invalid token return `401 { error: "unauthorized" }`.

## State Management (Frontend)

- `lib/supabase/client.ts` exports a singleton browser client.
- A `SupabaseProvider` (client component, `app/providers.tsx`) wraps the app, exposing `useUser()` returning `{ user, isLoading }` backed by `supabase.auth.onAuthStateChange`.
- Route protection: `middleware.ts` checks for a valid session cookie on `/dashboard`, `/upload`, and `/contracts/*`; unauthenticated requests redirect to `/sign-in`.
- No TanStack Query involvement — auth state is session-driven, not server-data-driven.

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `SignUpForm` | `app/(auth)/sign-up/page.tsx` | Client component; email/password/confirm fields, client-side validation (password ≥ 8 chars, emails match format), calls `signUp`, shows inline error on failure |
| `SignInForm` | `app/(auth)/sign-in/page.tsx` | Client component; email/password fields, calls `signInWithPassword`, shows "Invalid email or password" on 400 |
| `SignOutButton` | `components/ui/SignOutButton.tsx` | Client component; calls `signOut`, redirects to `/` |

## Design

Per `docs/design.md`: form inputs use `Radius-MD (6px)`, `Grey 100` border, `Blue 500` focus ring at 2px; primary CTA button uses `Blue 500` background, white text, `Radius-MD`; error text renders in `Red 700` on `Red 50` background per the Semantic Status Badge pattern; page uses the standard Page Wrapper (96px vertical / 112px horizontal padding, 40px section gap).

## Edge Cases

- **Invalid credentials:** Supabase returns a generic 400 — surface as "Invalid email or password" (do not reveal whether the email exists, to avoid user enumeration).
- **Unverified email sign-in attempt:** Supabase blocks sign-in until verified (default project setting) — surface "Please verify your email before signing in; check your inbox."
- **Duplicate sign-up:** Supabase returns a conflict — surface "An account with this email already exists. Try signing in instead."
- **Session expiry mid-session:** `onAuthStateChange` fires `SIGNED_OUT`; any in-flight upload/chat request that then 401s redirects to `/sign-in` with a "Your session expired — please sign in again" toast, preserving no unsaved form state beyond what's already persisted server-side.
- **Auth flow latency:** PRD requires ≤10s end-to-end; both `signUp` and `signInWithPassword` are single network calls to Supabase Auth, well within budget — no additional timeout handling needed beyond the default Supabase client timeout.
