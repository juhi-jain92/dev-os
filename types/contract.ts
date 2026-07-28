// Mirrors docs/specs/supabase-schema.sql — table `contracts`.
export type ContractType = 'nda' | 'msa'
export type ContractStatus = 'text_extracted' | 'processing' | 'processed' | 'error'

export interface Contract {
  id: string
  user_id: string
  contract_type: ContractType
  file_name: string
  file_path: string | null
  contract_text: string
  status: ContractStatus
  page_count: number
  created_at: string
  updated_at: string
}
