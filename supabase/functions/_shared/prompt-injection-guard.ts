// Detects and blocks prompt-injection attempts in user-supplied chat
// messages before they reach the LLM. Source: security-foundation skill §4.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|the\s+)?(previous|prior|above)\s+instructions?/i,
  /override\s+your\s+rules?/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
  /print\s+your\s+instructions?/i,
  /expose\s+(the\s+)?env(ironment)?\s+variables?/i,
  /show\s+(me\s+)?(the\s+)?api\s+keys?/i,
  /you\s+are\s+now\s+a\b/i,
  /act\s+as\s+(a|an)\b/i,
  /pretend\s+you\s+are\b/i,
  /jailbreak/i,
  /\bdan\s+mode\b/i,
  /developer\s+mode/i,
]

export interface SanitizeResult {
  blocked: boolean
  reason?: string
}

// Only screens the live user message — instructions embedded inside the
// contract text itself are never treated as commands; the system prompt
// already scopes the model to answering from that text, not obeying it.
export function sanitizeForLLM(message: string): SanitizeResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return { blocked: true, reason: 'prompt_injection_detected' }
    }
  }
  return { blocked: false }
}
