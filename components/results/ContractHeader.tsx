import type { Contract } from '@/types/contract'

interface ContractHeaderProps {
  contract: Contract
}

export function ContractHeader({ contract }: ContractHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-grey-900">{contract.file_name}</h1>
        <p className="mt-1 text-sm text-grey-500">{contract.contract_type.toUpperCase()}</p>
      </div>
      <div className="border-l-4 border-yellow-500 bg-yellow-50 px-4 py-3 text-base font-medium text-grey-900">
        This tool provides informational analysis only and is not legal advice.
      </div>
    </div>
  )
}
