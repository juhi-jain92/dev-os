// Shared Azure AI Foundry agent caller (Responses API), replacing GLM (Z.ai).
// 3-attempt exponential backoff on transient errors, mirroring the previous
// GLM client so a brief Azure blip doesn't surface as a user-facing failure.
//
// AZURE_AGENT_ENDPOINT must come from the Agents section of the AI Foundry
// portal and end with /responses. If the endpoint doesn't already end with
// /responses (e.g. a project inference URL was used instead), it is appended
// here — but that is not the documented agent endpoint shape and may fail;
// verify against the portal's Agents > your agent > Endpoint field if calls
// return "Missing required parameter: model" or similar.
const RETRY_DELAYS_MS = [1000, 2000, 4000]
// Foundry /openai/v1 endpoints only accept this preview version as of Aug 2026 —
// see https://github.com/Azure-Samples/ai-model-start/issues/2. Non-preview or
// older versions return "API version not supported"; if that error reappears,
// check the Microsoft Foundry REST reference for the current value.
const AZURE_API_VERSION = '2025-11-15-preview'

function resolveResponsesUrl(): string {
  const rawEndpoint = Deno.env.get('AZURE_AGENT_ENDPOINT') ?? ''
  const base = rawEndpoint.replace(/\/responses\/?$/, '')
  const responsesUrl = rawEndpoint.endsWith('/responses') ? rawEndpoint : `${base}/responses`
  return `${responsesUrl}?api-version=${AZURE_API_VERSION}`
}

export interface AzureAgentCallOptions {
  input: string
}

export async function callAzureAgent(options: AzureAgentCallOptions): Promise<Response> {
  const apiKey = Deno.env.get('AZURE_API_KEY') ?? ''
  let lastResponse: Response | null = null

  for (const delay of [0, ...RETRY_DELAYS_MS]) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

    // Do not pass `model` or `instructions` — the agent has both configured
    // in the AI Foundry portal; passing either causes a rejection error.
    const response = await fetch(resolveResponsesUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'api-key': apiKey,
      },
      body: JSON.stringify({
        input: [{ role: 'user', content: options.input }],
      }),
    })

    if (response.ok) return response
    lastResponse = response
    if (response.status !== 429 && response.status < 500) break
  }

  return lastResponse!
}

export function extractAzureOutputText(completion: unknown): string {
  if (typeof completion !== 'object' || completion === null) return ''
  const output = (completion as Record<string, unknown>).output
  if (!Array.isArray(output)) return ''

  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue
    const typed = item as Record<string, unknown>
    if (typed.type !== 'message' || !Array.isArray(typed.content)) continue

    for (const contentItem of typed.content) {
      if (typeof contentItem !== 'object' || contentItem === null) continue
      const typedContent = contentItem as Record<string, unknown>
      if (typedContent.type === 'output_text' && typeof typedContent.text === 'string') {
        return typedContent.text
      }
    }
  }

  return ''
}
