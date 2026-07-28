'use client'

import { useState } from 'react'

interface InlineEditFieldProps {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
}

export function InlineEditField({ initialValue, onSave, onCancel }: InlineEditFieldProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (value.trim().length === 0) {
      setError('Value cannot be empty')
      return
    }
    onSave(value.trim())
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') onCancel()
        }}
        className="rounded-md border border-blue-500 px-2 py-1 text-base font-medium text-grey-900 focus:outline-none"
      />
      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  )
}
