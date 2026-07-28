'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProcessExtraction } from '@/lib/queries/use-process-extraction'
import { ExtractionProgressIndicator } from './ExtractionProgressIndicator'

interface ProcessButtonProps {
  contractId: string
  customTerms: string[]
}

export function ProcessButton({ contractId, customTerms }: ProcessButtonProps) {
  const router = useRouter()
  const { mutate, isPending, isError, error } = useProcessExtraction(contractId)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  function handleClick() {
    setStep(2)
    mutate(customTerms, {
      onSuccess: () => {
        setStep(3)
        setTimeout(() => router.push(`/contracts/${contractId}`), 500)
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="self-start rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {isPending ? 'Processing…' : 'Process Contract'}
      </button>
      {isPending && <ExtractionProgressIndicator step={step} />}
      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as { message?: string })?.message ?? "We couldn't analyse this contract. Please try again."}
        </p>
      )}
    </div>
  )
}
