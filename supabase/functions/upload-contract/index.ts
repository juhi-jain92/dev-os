// Upload Edge Function — validates, extracts text with [PAGE N] markers,
// persists the contracts row, then fire-and-forget uploads the PDF to Storage.
// Source: docs/specs/upload-extraction-spec.md
import { requireAuth, serviceRoleClient } from '../_shared/auth.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { checkRateLimit, recordRateLimitEvent } from '../_shared/rate-limit.ts'
import { isAllowedExtension, sanitizeFileName } from '../_shared/file-validation.ts'
import { extractContractText } from '../../../lib/pdf/extract-text.ts'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 20
const MIN_WORDS = 100
const MAX_TOKENS = 15000
const MAX_UPLOADS_PER_HOUR = 20

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const auth = await requireAuth(req)
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401)
  const { user } = auth

  const form = await req.formData()
  const contractType = form.get('contract_type')
  const file = form.get('file')

  if (contractType !== 'nda' && contractType !== 'msa') {
    return jsonResponse({ error: 'invalid_contract_type' }, 400)
  }

  if (!(file instanceof File) || !isAllowedExtension(file.name) || file.type !== 'application/pdf') {
    return jsonResponse({ error: 'invalid_file_type' }, 400)
  }

  if (file.size > MAX_FILE_BYTES) {
    return jsonResponse({ error: 'file_too_large', max_mb: 10 }, 413)
  }

  const safeFileName = sanitizeFileName(file.name)

  const service = serviceRoleClient()

  const rateLimit = await checkRateLimit(service, user.id, 'process-extraction', MAX_UPLOADS_PER_HOUR)
  if (rateLimit.limited) {
    return jsonResponse({ error: 'rate_limited', retry_after_seconds: rateLimit.retryAfterSeconds }, 429)
  }

  let extracted
  try {
    const buffer = new Uint8Array(await file.arrayBuffer())
    extracted = await extractContractText(buffer)
  } catch {
    return jsonResponse({ error: 'extraction_failed' }, 500)
  }

  if (extracted.pageCount > MAX_PAGES) {
    return jsonResponse(
      { error: 'too_many_pages', max_pages: MAX_PAGES, actual_pages: extracted.pageCount },
      422
    )
  }

  if (extracted.wordCount < MIN_WORDS) {
    return jsonResponse(
      { error: 'scanned_pdf_unsupported', message: 'Scanned PDFs are not supported yet' },
      422
    )
  }

  if (extracted.estimatedTokens > MAX_TOKENS) {
    return jsonResponse({ error: 'contract_too_long', max_tokens: MAX_TOKENS }, 422)
  }

  await recordRateLimitEvent(service, user.id, 'process-extraction')

  const { data: contract, error: insertError } = await service
    .from('contracts')
    .insert({
      user_id: user.id,
      contract_type: contractType,
      file_name: safeFileName,
      contract_text: extracted.text,
      status: 'text_extracted',
      page_count: extracted.pageCount,
    })
    .select('id, status, page_count')
    .single()

  if (insertError || !contract) return jsonResponse({ error: 'extraction_failed' }, 500)

  // Fire-and-forget: Storage upload never blocks or fails the response already sent.
  // EdgeRuntime.waitUntil keeps this running after the response is returned
  // (a plain unawaited promise can be killed when the isolate tears down).
  const storageUpload = (async () => {
    const path = `${user.id}/${contract.id}/${safeFileName}`
    const { error: storageError } = await service.storage
      .from('contracts')
      .upload(path, file, { contentType: 'application/pdf' })

    if (!storageError) {
      await service.from('contracts').update({ file_path: path }).eq('id', contract.id)
    } else {
      console.error('Storage upload failed', storageError)
    }
  })()
  // @ts-expect-error -- EdgeRuntime is a Supabase Edge Functions global, not in standard Deno types.
  EdgeRuntime.waitUntil(storageUpload)

  return jsonResponse({
    contract_id: contract.id,
    status: contract.status,
    page_count: contract.page_count,
  })
})
