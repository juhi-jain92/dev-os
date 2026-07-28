// Mirrors docs/specs/supabase-schema.sql — tables `chat_sessions` and `chat_messages`.
export type MessageRole = 'user' | 'assistant'
export type ContextSource = 'contract' | 'history' | 'both'

export interface ChatSession {
  id: string
  contract_id: string
  user_id: string
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: MessageRole
  content: string
  page_citation: number | null
  context_source: ContextSource | null
  created_at: string
}
