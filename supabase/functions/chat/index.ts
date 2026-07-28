// Chat Edge Function — classifies each question, retrieves matching context,
// and answers with a system prompt matched to that source.
// Source: docs/specs/chat-spec.md
import { requireAuth, serviceRoleClient } from '../_shared/auth.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { callGlm } from '../_shared/glm-client.ts'
import { checkRateLimit, recordRateLimitEvent } from '../_shared/rate-limit.ts'
import { sanitizeForLLM } from '../_shared/prompt-injection-guard.ts'
import { classifyQuery } from '../../../lib/openai/prompts/classify-query.ts'
import { buildMessages, parsePageCitation } from '../../../lib/openai/prompts/chat.ts'

const MAX_HISTORY_FETCH = Number(Deno.env.get('MAX_CHAT_HISTORY') ?? '200')
const MAX_CHAT_PER_HOUR = 30

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const auth = await requireAuth(req)
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401)
  const { supabase, user } = auth

  const { contract_id, message } = await req.json()

  if (!message || typeof message !== 'string' || message.length === 0 || message.length > 2000) {
    return jsonResponse({ error: 'invalid_message' }, 422)
  }

  const injectionCheck = sanitizeForLLM(message)
  if (injectionCheck.blocked) {
    return jsonResponse({ error: 'prompt_injection_detected' }, 400)
  }

  const service = serviceRoleClient()
  const rateLimit = await checkRateLimit(service, user.id, 'chat', MAX_CHAT_PER_HOUR)
  if (rateLimit.limited) {
    return jsonResponse({ error: 'rate_limited', retry_after_seconds: rateLimit.retryAfterSeconds }, 429)
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, contract_type, contract_text')
    .eq('id', contract_id)
    .single()

  if (!contract) return jsonResponse({ error: 'contract_not_found' }, 404)

  // Lazy session creation.
  let { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contract_id)
    .single()

  if (!session) {
    const { data: newSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({ contract_id, user_id: user.id })
      .select('id')
      .single()
    if (sessionError || !newSession) return jsonResponse({ error: 'chat_timeout' }, 504)
    session = newSession
  }

  // CRITICAL: history must be loaded before the new user message is saved,
  // or the classifier will see the new message as part of its own history.
  const { data: historyRows } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_FETCH)

  const history = (historyRows ?? []) as { role: 'user' | 'assistant'; content: string }[]

  const contextSource = classifyQuery(message)
  const messages = buildMessages(contextSource, contract.contract_type, contract.contract_text, history, message)

  const glmResponse = await callGlm({
    model: 'glm-4.7-flash',
    temperature: 0.4,
    maxTokens: 1000,
    messages,
  })

  if (!glmResponse.ok) return jsonResponse({ error: 'chat_timeout' }, 504)

  const completion = await glmResponse.json()
  const content: string = completion.choices?.[0]?.message?.content ?? ''
  const pageCitation = contextSource === 'history' ? null : parsePageCitation(content)

  await recordRateLimitEvent(service, user.id, 'chat')

  const { error: userInsertError } = await service.from('chat_messages').insert({
    session_id: session.id,
    user_id: user.id,
    role: 'user',
    content: message,
    context_source: null,
  })
  if (userInsertError) return jsonResponse({ error: 'chat_timeout' }, 504)

  const { data: assistantMessage, error: assistantInsertError } = await service
    .from('chat_messages')
    .insert({
      session_id: session.id,
      user_id: user.id,
      role: 'assistant',
      content,
      page_citation: pageCitation,
      context_source: contextSource,
    })
    .select('id')
    .single()

  if (assistantInsertError || !assistantMessage) return jsonResponse({ error: 'chat_timeout' }, 504)

  return jsonResponse({
    message_id: assistantMessage.id,
    role: 'assistant',
    content,
    page_citation: pageCitation,
    context_source: contextSource,
  })
})
