'use client'

import { useRef, useState } from 'react'

interface FileDropzoneProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
  error: string | null
}

export function FileDropzone({ onFileSelected, disabled, error }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSelect(file: File | undefined) {
    if (!file) return
    onFileSelected(file) // client-side type/size validation happens in the parent, which owns the error message
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center ${
          isDragOver ? 'border-blue-500' : 'border-grey-200'
        } bg-grey-25`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          if (!disabled) validateAndSelect(e.dataTransfer.files[0])
        }}
      >
        <p className="text-sm text-grey-500">Drag and drop a PDF here, or</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => validateAndSelect(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
