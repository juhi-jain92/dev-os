import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

// Every Edge Function calls this first. It validates the caller's JWT and
// returns a Supabase client scoped to that user (RLS-enforced) plus the
// user object. Source: docs/specs/auth-spec.md — API / Client Calls.
export interface AuthContext {
  supabase: SupabaseClient
  user: User
}

export async function requireAuth(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

  if (error || !user) return null

  return { supabase, user }
}

// Service-role client for operations that must bypass RLS (e.g. writing
// results after the caller's own auth has already been verified above).
export function serviceRoleClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}
