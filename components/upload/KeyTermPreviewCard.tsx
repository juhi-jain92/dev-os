'use client'

import { useState } from 'react'
import { STANDARD_TERMS, MAX_CUSTOM_TERMS } from '@/lib/config/standard-terms'
import type { ContractType } from '@/types/contract'

interface KeyTermPreviewCardProps {
  contractType: ContractType
  customTerms: string[]
  onAddCustomTerm: (term: string) => void
}

export function KeyTermPreviewCard({ contractType, customTerms, onAddCustomTerm }: KeyTermPreviewCardProps) {
  const [draft, setDraft] = useState('')
  const standardTerms = STANDARD_TERMS[contractType]

  function handleAdd() {
    const trimmed = draft.trim()
    if (!trimmed || customTerms.length >= MAX_CUSTOM_TERMS) return
    onAddCustomTerm(trimmed)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-6">
      <h2 className="text-base font-medium text-grey-900">Terms we'll extract</h2>
      <div className="flex flex-col gap-2">
        {standardTerms.map((term) => (
          <span key={term} className="text-sm text-grey-900">
            {term}
          </span>
        ))}
        {customTerms.map((term) => (
          <span key={term} className="flex items-center gap-2 text-sm text-grey-900">
            {term}
            <span className="rounded border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[12px] font-medium text-yellow-800">
              Custom
            </span>
          </span>
        ))}
      </div>

      {customTerms.length < MAX_CUSTOM_TERMS && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a custom term"
            className="flex-1 rounded-md border border-grey-100 px-3 py-2 text-sm text-grey-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md border border-grey-100 px-3 py-2 text-sm font-medium text-grey-900 hover:bg-grey-50"
          >
            + Add Key Term
          </button>
        </div>
      )}
    </div>
  )
}
