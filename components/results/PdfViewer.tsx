'use client'

import { useEffect, useRef, useState } from 'react'

interface PdfViewerProps {
  fileUrl: string
  targetPage: number | null
}

export function PdfViewer({ fileUrl, targetPage }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const doc = await pdfjsLib.getDocument(fileUrl).promise
        if (cancelled) return

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: 1.2 })
          const canvas = document.createElement('canvas')
          canvas.id = `pdf-page-${i}`
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'mb-4 mx-auto shadow-sm'
          container.appendChild(canvas)

          const ctx = canvas.getContext('2d')
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  useEffect(() => {
    if (targetPage === null) return
    const el = containerRef.current?.querySelector(`#pdf-page-${targetPage}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [targetPage])

  if (error) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-grey-500">
        This PDF couldn't be rendered.{' '}
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
          Download PDF
        </a>
      </div>
    )
  }

  return <div ref={containerRef} className="max-h-[70vh] overflow-y-auto rounded-lg bg-white p-6" />
}
