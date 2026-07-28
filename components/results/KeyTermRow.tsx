'use client'

import { useState } from 'react'
import { ConfidenceBadge } from './ConfidenceBadge'
import { WhyExpandable } from './WhyExpandable'
import { InlineEditField } from './InlineEditField'
import type { KeyTerm, CustomKeyTerm, TermTable } from '@/types/key-term'

interface KeyTermRowProps {
  term: KeyTerm | CustomKeyTerm
  table: TermTable
  onPageClick: (page: number) => void
  onSave: (id: string, table: TermTable, value: string) => void
}

export function KeyTermRow({ term, table, onPageClick, onSave }: KeyTermRowProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="flex flex-col gap-1 border-b border-grey-100 py-3 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-medium text-grey-900">{term.term_name}</span>
        <div className="flex items-center gap-2">
          {term.is_edited && (
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700">
              Edited
            </span>
          )}
          <ConfidenceBadge score={term.confidence_score} />
        </div>
      </div>

      {isEditing ? (
        <InlineEditField
          initialValue={term.value}
          onSave={(value) => {
            onSave(term.id, table, value)
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-left text-base font-medium text-grey-900 hover:underline"
        >
          {term.value}
        </button>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onPageClick(term.page_number)} className="text-[12px] text-blue-500 hover:underline">
          Page {term.page_number}
        </button>
        <WhyExpandable sourceSentence={term.source_sentence} />
      </div>
    </div>
  )
}
