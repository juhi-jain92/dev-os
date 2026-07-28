// update-key-term Edge Function — inline correction for an extracted term.
// Handles both key_terms and custom_key_terms via a `table` field.
// Source: docs/specs/key-term-editing-spec.md
import { requireAuth } from '../_shared/auth.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'

type TermTable = 'key_terms' | 'custom_key_terms'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const auth = await requireAuth(req)
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401)
  const { supabase } = auth

  const { id, table, value } = await req.json()
  const termTable: TermTable = table === 'custom_key_terms' ? 'custom_key_terms' : 'key_terms'

  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) {
    return jsonResponse({ error: 'invalid_value' }, 422)
  }

  // RLS scopes this to auth.uid() = user_id, so a term belonging to another user simply won't be found.
  const { data: existing } = await supabase
    .from(termTable)
    .select('id, value, is_edited, original_ai_value')
    .eq('id', id)
    .single()

  if (!existing) return jsonResponse({ error: 'term_not_found' }, 404)

  const update = existing.is_edited
    ? { value }
    : { value, original_ai_value: existing.value, is_edited: true }

  const { data: updated, error } = await supabase
    .from(termTable)
    .update(update)
    .eq('id', id)
    .select('id, value, is_edited, original_ai_value')
    .single()

  if (error || !updated) return jsonResponse({ error: 'term_not_found' }, 404)

  return jsonResponse(updated)
})
