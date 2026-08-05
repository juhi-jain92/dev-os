// System prompt builder + retrieval config for the chat Edge Function.
// Source: docs/specs/chat-spec.md — System prompts, Retrieval.
import type { ContextSource } from '../../../types/chat.ts'
import type { ContractType } from '../../../types/contract.ts'

export interface ChatMessageLike {
  role: 'user' | 'assistant'
  content: string
}

const RETRIEVAL_DEPTH: Record<ContextSource, number> = {
  contract: 10,
  history: 20,
  both: 10,
}

export function retrievalDepth(source: ContextSource): number {
  return RETRIEVAL_DEPTH[source]
}

export function buildSystemPrompt(
  source: ContextSource,
  contractType: ContractType,
  contractText: string
): string {
  const label = contractType === 'nda' ? 'NDA' : 'MSA'

  if (source === 'history') {
    return `You are ContractIQ's contract assistant. Answer the user's question using ONLY the prior conversation turns provided below — do not reference or infer anything from the contract document itself. End your answer with '[From conversation]'.`
  }

  if (source === 'both') {
    return `You are ContractIQ's contract assistant. Answer using both the contract text and the prior conversation below. Attribute each fact in your answer to its source inline — write '(from the contract)' or '(from our conversation)' next to the relevant part of the answer. Do not use general legal knowledge.

--- CONTRACT TEXT ---
${contractText}`
  }

  return `You are ContractIQ's contract assistant. Answer the user's question about the following ${label} contract using ONLY the document text provided below. If the answer is not in the document, respond exactly: 'I cannot find this in the document.' Every substantive answer must end with a citation in the form [Page X], where X is the page number (from the [PAGE N] markers) the answer was drawn from. Do not use general legal knowledge or speculate.

--- CONTRACT TEXT ---
${contractText}`
}

// Azure AI Foundry agent takes a single user input string per turn (no
// system/instructions field — the agent has its own configured in the
// portal), so all context is bundled into one message here.
export function buildAzureChatInput(
  source: ContextSource,
  contractType: ContractType,
  contractText: string,
  history: ChatMessageLike[],
  newMessage: string
): string {
  const depth = retrievalDepth(source)
  const recentHistory = history.slice(-depth)

  const historyBlock =
    recentHistory.length > 0
      ? `\n\n--- CONVERSATION HISTORY ---\n${recentHistory.map((m) => `${m.role}: ${m.content}`).join('\n')}`
      : ''

  return `${buildSystemPrompt(source, contractType, contractText)}${historyBlock}\n\n--- USER QUESTION ---\n${newMessage}`
}

export function parsePageCitation(content: string): number | null {
  const match = content.match(/\[Page (\d+)\]/i)
  return match ? Number(match[1]) : null
}
