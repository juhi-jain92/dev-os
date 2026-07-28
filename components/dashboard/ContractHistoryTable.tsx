'use client'

import { useRouter } from 'next/navigation'
import type { ContractSortOrder, ContractSummary } from '@/lib/queries/use-contracts'
import type { ContractStatus } from '@/types/contract'

interface ContractHistoryTableProps {
  contracts: ContractSummary[]
  sortOrder: ContractSortOrder
  onSortChange: (sortOrder: ContractSortOrder) => void
}

const STATUS_BADGE: Record<ContractStatus, { label: string; classes: string }> = {
  processed: { label: 'Processed', classes: 'bg-green-50 border-green-200 text-green-700' },
  processing: { label: 'Processing', classes: 'bg-blue-50 border-blue-200 text-blue-700' },
  text_extracted: { label: 'Processing', classes: 'bg-blue-50 border-blue-200 text-blue-700' },
  error: { label: 'Error', classes: 'bg-red-50 border-red-200 text-red-700' },
}

const COLUMN_SORT: Record<'date' | 'name' | 'type', ContractSortOrder> = {
  date: 'created_at.desc',
  name: 'file_name.asc',
  type: 'contract_type.asc',
}

export function ContractHistoryTable({ contracts, sortOrder, onSortChange }: ContractHistoryTableProps) {
  const router = useRouter()
  const recent = contracts.slice(0, 5)

  return (
    <div className="overflow-hidden rounded-lg bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-grey-100">
            <th className="px-4 py-3">
              <button
                type="button"
                className="font-medium text-grey-900 hover:underline"
                onClick={() => onSortChange(COLUMN_SORT.name)}
              >
                Name
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                className="font-medium text-grey-900 hover:underline"
                onClick={() => onSortChange(COLUMN_SORT.type)}
              >
                Type
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                className="font-medium text-grey-900 hover:underline"
                onClick={() => onSortChange(COLUMN_SORT.date)}
              >
                Date
              </button>
            </th>
            <th className="px-4 py-3 font-medium text-grey-900">Status</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((contract) => {
            const badge = STATUS_BADGE[contract.status]
            return (
              <tr
                key={contract.id}
                className="cursor-pointer border-b border-grey-100 last:border-0 hover:bg-grey-50"
                onClick={() => router.push(`/contracts/${contract.id}`)}
              >
                <td className="px-4 py-3 text-grey-900">{contract.file_name}</td>
                <td className="px-4 py-3 text-grey-500">{contract.contract_type.toUpperCase()}</td>
                <td className="px-4 py-3 text-grey-500">
                  {new Date(contract.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-2 py-0.5 text-[12px] font-medium ${badge.classes}`}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {contracts.length > 5 && (
        <div className="border-t border-grey-100 px-4 py-3 text-[12px] text-grey-500">
          Showing 5 most recent of {contracts.length} contracts
        </div>
      )}
    </div>
  )
}
