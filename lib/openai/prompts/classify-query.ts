// Heuristic query classifier for chat context retrieval.
// Source: docs/specs/chat-spec.md — Query classification.
export type ContextSource = 'contract' | 'history' | 'both'

const HISTORY_PATTERNS = /\b(you said|earlier|what did you mean|we discussed|before|previously|last time|you mentioned)\b/i
const CONTRACT_PATTERNS = /\b(the contract|this document|the nda|the msa|the agreement|clause|section|page \d+)\b/i

export function classifyQuery(question: string): ContextSource {
  const mentionsHistory = HISTORY_PATTERNS.test(question)
  const mentionsContract = CONTRACT_PATTERNS.test(question)

  if (mentionsHistory && mentionsContract) return 'both'
  if (mentionsHistory) return 'history'
  if (mentionsContract) return 'contract'
  return 'both' // ambiguous — safer to include both sources than guess wrong
}
