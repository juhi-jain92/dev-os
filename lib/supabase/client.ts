import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client. Uses the anon key only — RLS enforces
// per-user data isolation (see docs/specs/supabase-schema.sql).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
