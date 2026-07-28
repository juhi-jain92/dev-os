// process-extraction Edge Function — the core AI component. Builds a
// few-shot prompt, calls OpenAI in JSON mode, validates output, persists
// key_terms / custom_key_terms. Source: docs/specs/key-term-extraction-spec.md
import { requireAuth, serviceRoleClient } from '../_shared/auth.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { checkRateLimit, recordRateLimitEvent } from '../_shared/rate-limit.ts'
import { callGlm } from '../_shared/glm-client.ts'
import { buildNdaExtractionPrompt } from '../../../lib/openai/prompts/extraction-nda.ts'
import { buildMsaExtractionPrompt } from '../../../lib/openai/prompts/extraction-msa.ts'
import { parseExtractionResponse, validateTerms } from '../../../lib/openai/prompts/parse-extraction.ts'

const MAX_CUSTOM_TERMS = 5
const MAX_EXTRACTIONS_PER_HOUR = 20

function callGLM(messages: unknown[]): Promise<Response> {
  return callGlm({
    model: 'glm-4.7-flash',
    temperature: 0.1,
    maxTokens: 2000,
    responseFormat: { type: 'json_object' },
    messages,
  })
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const auth = await requireAuth(req)
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401)
  const { user } = auth

  const { contract_id, custom_terms } = await req.json()
  const customTerms: string[] = Array.isArray(custom_terms) ? custom_terms : []

  if (customTerms.length > MAX_CUSTOM_TERMS) {
    return jsonResponse({ error: 'too_many_custom_terms', max: MAX_CUSTOM_TERMS }, 422)
  }

  const service = serviceRoleClient()

  const { data: contract } = await service
    .from('contracts')
    .select('id, user_id, contract_type, contract_text, status, page_count')
    .eq('id', contract_id)
    .eq('user_id', user.id)
    .single()

  if (!contract) return jsonResponse({ error: 'contract_not_found' }, 404)
  if (contract.status !== 'text_extracted') {
    return jsonResponse({ error: 'already_processed' }, 409)
  }

  const rateLimit = await checkRateLimit(service, user.id, 'process-extraction', MAX_EXTRACTIONS_PER_HOUR)
  if (rateLimit.limited) {
    return jsonResponse({ error: 'rate_limited', retry_after_seconds: rateLimit.retryAfterSeconds }, 429)
  }

  const systemPrompt =
    contract.contract_type === 'nda'
      ? buildNdaExtractionPrompt(customTerms)
      : buildMsaExtractionPrompt(customTerms)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contract.contract_text },
  ]

  let response = await callGLM(messages)
  if (!response.ok) {
    await service.from('contracts').update({ status: 'error' }).eq('id', contract.id)
    return jsonResponse({ error: 'extraction_failed' }, 502)
  }

  let completion = await response.json()
  let content: string = completion.choices?.[0]?.message?.content ?? ''
  let terms = parseExtractionResponse(content)

  if (terms === null) {
    // One retry: ask the model to correct its own output shape.
    const retryMessages = [
      ...messages,
      { role: 'assistant', content },
      {
        role: 'user',
        content:
          'Your previous response was not valid JSON. Return only the JSON object { "terms": [...] }, no explanation.',
      },
    ]
    response = await callGLM(retryMessages)
    if (!response.ok) {
      await service.from('contracts').update({ status: 'error' }).eq('id', contract.id)
      return jsonResponse({ error: 'extraction_failed' }, 502)
    }
    completion = await response.json()
    content = completion.choices?.[0]?.message?.content ?? ''
    terms = parseExtractionResponse(content)
  }

  if (terms === null) {
    await service.from('contracts').update({ status: 'error' }).eq('id', contract.id)
    return jsonResponse(
      { error: 'extraction_failed', message: "We couldn't analyse this contract. Please try again in a few minutes." },
      502
    )
  }

  const validTerms = validateTerms(terms, contract.page_count)
  const customTermNamesLower = new Set(customTerms.map((t) => t.toLowerCase()))

  const standardTermRows = validTerms
    .filter((t) => !customTermNamesLower.has(t.term_name.toLowerCase()))
    .map((t) => ({
      contract_id: contract.id,
      user_id: user.id,
      term_name: t.term_name,
      value: t.value,
      page_number: t.page_number,
      confidence_score: t.confidence_score,
      source_sentence: t.source_sentence,
    }))

  const customTermRows = validTerms
    .filter((t) => customTermNamesLower.has(t.term_name.toLowerCase()))
    .map((t) => ({
      contract_id: contract.id,
      user_id: user.id,
      term_input: t.term_name,
      term_name: t.term_name,
      value: t.value,
      page_number: t.page_number,
      confidence_score: t.confidence_score,
      source_sentence: t.source_sentence,
    }))

  if (standardTermRows.length > 0) {
    await service.from('key_terms').insert(standardTermRows)
  }
  if (customTermRows.length > 0) {
    await service.from('custom_key_terms').insert(customTermRows)
  }

  await recordRateLimitEvent(service, user.id, 'process-extraction')
  await service.from('contracts').update({ status: 'processed' }).eq('id', contract.id)

  return jsonResponse({
    contract_id: contract.id,
    status: 'processed',
    term_count: standardTermRows.length + customTermRows.length,
  })
})
