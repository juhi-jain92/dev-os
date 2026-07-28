import { KeyTermRow } from './KeyTermRow'
import type { KeyTerm, CustomKeyTerm, TermTable } from '@/types/key-term'

interface KeyTermsPanelProps {
  keyTerms: KeyTerm[]
  customKeyTerms: CustomKeyTerm[]
  onPageClick: (page: number) => void
  onSave: (id: string, table: TermTable, value: string) => void
}

export function KeyTermsPanel({ keyTerms, customKeyTerms, onPageClick, onSave }: KeyTermsPanelProps) {
  const rows = [
    ...keyTerms.map((term) => ({ term, table: 'key_terms' as const })),
    ...customKeyTerms.map((term) => ({ term, table: 'custom_key_terms' as const })),
  ].sort((a, b) => a.term.page_number - b.term.page_number)

  return (
    <div className="flex flex-col rounded-lg bg-white p-6">
      <h2 className="mb-4 text-base font-medium text-grey-900">Key Terms</h2>
      {rows.map(({ term, table }) => (
        <KeyTermRow key={term.id} term={term} table={table} onPageClick={onPageClick} onSave={onSave} />
      ))}
    </div>
  )
}
