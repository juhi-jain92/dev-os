// Shared GLM (Z.ai) chat-completions caller with 3-attempt exponential
// backoff for transient errors (rate limits, 5xx). Used by chat and
// process-extraction so a brief Z.ai blip doesn't surface as a user-facing
// failure. Source: docs/specs/chat-spec.md, docs/specs/key-term-extraction-spec.md
const RETRY_DELAYS_MS = [1000, 2000, 4000]

export interface GlmCallOptions {
  model: string
  temperature: number
  maxTokens: number
  messages: unknown[]
  responseFormat?: { type: 'json_object' }
}

export async function callGlm(options: GlmCallOptions): Promise<Response> {
  let lastResponse: Response | null = null

  for (const delay of [0, ...RETRY_DELAYS_MS]) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('GLM_API_KEY')}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        thinking: { type: 'disabled' },
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        messages: options.messages,
      }),
    })

    if (response.ok) return response
    lastResponse = response
    // Retry on rate limits (429) and server errors (5xx); don't retry other 4xx.
    if (response.status !== 429 && response.status < 500) break
  }

  return lastResponse!
}
