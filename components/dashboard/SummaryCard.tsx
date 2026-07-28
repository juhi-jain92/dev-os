import type { ContractSummary } from '@/lib/queries/use-contracts'

interface SummaryCardProps {
  contracts: ContractSummary[]
}

export function SummaryCard({ contracts }: SummaryCardProps) {
  const ndaCount = contracts.filter((c) => c.contract_type === 'nda').length
  const msaCount = contracts.filter((c) => c.contract_type === 'msa').length

  return (
    <div className="flex gap-8 rounded-lg bg-white p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-medium text-grey-900">{contracts.length}</span>
        <span className="text-[12px] leading-[18px] text-grey-500">Total contracts</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-medium text-grey-900">{ndaCount}</span>
        <span className="text-[12px] leading-[18px] text-grey-500">NDA</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-medium text-grey-900">{msaCount}</span>
        <span className="text-[12px] leading-[18px] text-grey-500">MSA</span>
      </div>
    </div>
  )
}
