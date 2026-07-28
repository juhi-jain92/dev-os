'use client'

import { useEffect, useRef } from 'react'
import { parsePageMarkers } from '@/lib/pdf/parse-markers'

interface TextViewerProps {
  contractText: string
  targetPage: number | null
}

export function TextViewer({ contractText, targetPage }: TextViewerProps) {
  const sections = parsePageMarkers(contractText)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (targetPage === null) return
    const el = containerRef.current?.querySelector(`#page-${targetPage}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [targetPage])

  return (
    <div ref={containerRef} className="max-h-[70vh] overflow-y-auto rounded-lg bg-white p-6">
      {sections.map((section) => (
        <section key={section.page} id={`page-${section.page}`} className="mb-6">
          <p className="mb-2 text-[12px] font-medium text-grey-500">Page {section.page}</p>
          <p className="whitespace-pre-wrap text-sm text-grey-900">{section.content}</p>
        </section>
      ))}
    </div>
  )
}
