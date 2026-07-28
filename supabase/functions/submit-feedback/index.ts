// submit-feedback Edge Function. Source: docs/specs/feedback-spec.md
import { requireAuth } from '../_shared/auth.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const auth = await requireAuth(req)
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401)
  const { supabase, user } = auth

  const { contract_id, rating, comment } = await req.json()

  if (rating !== 'up' && rating !== 'down') {
    return jsonResponse({ error: 'invalid_rating' }, 422)
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id')
    .eq('id', contract_id)
    .single()

  if (!contract) return jsonResponse({ error: 'contract_not_found' }, 404)

  const { data: feedback, error } = await supabase
    .from('user_feedback')
    .insert({
      contract_id,
      user_id: user.id,
      rating,
      comment: typeof comment === 'string' && comment.length > 0 ? comment.slice(0, 1000) : null,
    })
    .select('id')
    .single()

  if (error || !feedback) return jsonResponse({ error: 'contract_not_found' }, 404)

  return jsonResponse({ id: feedback.id })
})
