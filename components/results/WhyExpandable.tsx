'use client'

import { useState } from 'react'

interface WhyExpandableProps {
  sourceSentence: string
}

export function WhyExpandable({ sourceSentence }: WhyExpandableProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!sourceSentence) return null

  return (
    <div className="text-[12px] leading-[18px] text-grey-500">
      <button type="button" onClick={() => setIsExpanded((prev) => !prev)} className="text-blue-500 hover:underline">
        {isExpanded ? 'Hide source' : 'Why?'}
      </button>
      {isExpanded && <p className="mt-1 italic text-grey-500">{sourceSentence}</p>}
    </div>
  )
}
