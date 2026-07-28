import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Sliding-window per-user rate limit against `rate_limit_events`.
// Source: docs/specs/upload-extraction-spec.md, docs/specs/ai-eval-guardrails-spec.md.
export type RateLimitedFunction = 'process-extraction' | 'chat'

export interface RateLimitResult {
  limited: boolean
  retryAfterSeconds: number
}

export async function checkRateLimit(
  service: SupabaseClient,
  userId: string,
  functionName: RateLimitedFunction,
  maxPerHour: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data, error } = await service
    .from('rate_limit_events')
    .select('created_at')
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })

  if (error) throw error

  const events = data ?? []
  if (events.length < maxPerHour) {
    return { limited: false, retryAfterSeconds: 0 }
  }

  const oldest = new Date(events[0].created_at).getTime()
  const retryAfterSeconds = Math.max(0, Math.ceil((oldest + 60 * 60 * 1000 - Date.now()) / 1000))
  return { limited: true, retryAfterSeconds }
}

export async function recordRateLimitEvent(
  service: SupabaseClient,
  userId: string,
  functionName: RateLimitedFunction
): Promise<void> {
  await service.from('rate_limit_events').insert({ user_id: userId, function_name: functionName })
}
