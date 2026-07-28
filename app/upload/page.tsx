'use client'

import { useState } from 'react'
import { useUser } from '@/lib/supabase/provider'
import { useUploadContract, type UploadError } from '@/lib/queries/use-upload-contract'
import { ContractTypeSelect } from '@/components/upload/ContractTypeSelect'
import { FileDropzone } from '@/components/upload/FileDropzone'
import { KeyTermPreviewCard } from '@/components/upload/KeyTermPreviewCard'
import { ProcessButton } from '@/components/upload/ProcessButton'
import type { ContractType } from '@/types/contract'

const MAX_FILE_BYTES = 10 * 1024 * 1024

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_contract_type: 'Please select a contract type.',
  invalid_file_type: 'Only PDF files are supported.',
  file_too_large: 'File exceeds the 10 MB limit.',
  too_many_pages: 'This contract exceeds the 20-page limit.',
  scanned_pdf_unsupported: 'Scanned PDFs are not supported yet.',
  contract_too_long: 'This contract is too long to process.',
  rate_limited: 'Too many uploads — please try again later.',
  extraction_failed: 'Something went wrong reading this file. Please try again.',
}

export default function UploadPage() {
  const { user } = useUser()
  const { upload } = useUploadContract(user?.id)

  const [contractType, setContractType] = useState<ContractType>('nda')
  const [customTerms, setCustomTerms] = useState<string[]>([])
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [uploadedContractId, setUploadedContractId] = useState<string | null>(null)

  async function handleFileSelected(file: File) {
    setError(null)

    if (file.type !== 'application/pdf') {
      setError(ERROR_MESSAGES.invalid_file_type)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(ERROR_MESSAGES.file_too_large)
      return
    }

    setState('uploading')
    try {
      const result = await upload(file, contractType)
      setState('done')
      setUploadedContractId(result.contract_id)
    } catch (err) {
      const uploadError = err as UploadError
      setError(ERROR_MESSAGES[uploadError.error] ?? 'Upload failed. Please try again.')
      setState('error')
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-28">
      <h1 className="text-2xl font-semibold text-grey-900">Review a Contract</h1>
      <div className="mt-8 flex flex-col gap-6">
        <ContractTypeSelect value={contractType} onChange={setContractType} />
        <FileDropzone
          onFileSelected={handleFileSelected}
          disabled={state === 'uploading' || !!uploadedContractId}
          error={error}
        />
        {state === 'uploading' && <p className="text-sm text-grey-500">Uploading…</p>}
        <KeyTermPreviewCard
          contractType={contractType}
          customTerms={customTerms}
          onAddCustomTerm={(term) => setCustomTerms((prev) => [...prev, term])}
        />
        {uploadedContractId && <ProcessButton contractId={uploadedContractId} customTerms={customTerms} />}
      </div>
    </main>
  )
}
