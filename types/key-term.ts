// Mirrors docs/specs/supabase-schema.sql — tables `key_terms` and `custom_key_terms`.
export interface KeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  value: string
  original_ai_value: string | null
  page_number: number
  confidence_score: number
  source_sentence: string
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface CustomKeyTerm extends KeyTerm {
  term_input: string
  is_manual: true
}

export type TermTable = 'key_terms' | 'custom_key_terms'
