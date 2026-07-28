'use client'

import { useState } from 'react'
import { useContract, useSignedPdfUrl } from '@/lib/queries/use-contract'
import { useUpdateKeyTerm } from '@/lib/queries/use-update-key-term'
import { ContractHeader } from '@/components/results/ContractHeader'
import { PdfViewer } from '@/components/results/PdfViewer'
import { TextViewer } from '@/components/results/TextViewer'
import { KeyTermsPanel } from '@/components/results/KeyTermsPanel'
import { FeedbackWidget } from '@/components/results/FeedbackWidget'
import { ChatPanel } from '@/components/results/ChatPanel'
import type { TermTable } from '@/types/key-term'

export default function ContractResultsPage({ params }: { params: { id: string } }) {
  const { data: contract, isLoading } = useContract(params.id)
  const { data: signedUrl } = useSignedPdfUrl(contract?.file_path ?? null)
  const updateKeyTerm = useUpdateKeyTerm(params.id)
  const [targetPage, setTargetPage] = useState<number | null>(null)

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-28">
        <p className="text-sm text-grey-500">Loading…</p>
      </main>
    )
  }

  if (!contract) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-28">
        <p className="text-sm text-grey-500">Contract not found.</p>
      </main>
    )
  }

  function handleSave(id: string, table: TermTable, value: string) {
    updateKeyTerm.mutate({ id, table, value })
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-28">
      <ContractHeader contract={contract} />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          {signedUrl ? (
            <PdfViewer fileUrl={signedUrl} targetPage={targetPage} />
          ) : (
            <TextViewer contractText={contract.contract_text} targetPage={targetPage} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <KeyTermsPanel
            keyTerms={contract.key_terms}
            customKeyTerms={contract.custom_key_terms}
            onPageClick={setTargetPage}
            onSave={handleSave}
          />
          <ChatPanel contractId={params.id} />
          <FeedbackWidget contractId={params.id} />
        </div>
      </div>
    </main>
  )
}
