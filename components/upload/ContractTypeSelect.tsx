import type { ContractType } from '@/types/contract'

interface ContractTypeSelectProps {
  value: ContractType
  onChange: (value: ContractType) => void
}

export function ContractTypeSelect({ value, onChange }: ContractTypeSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="contract-type" className="text-sm font-medium text-grey-900">
        Contract type
      </label>
      <select
        id="contract-type"
        value={value}
        onChange={(e) => onChange(e.target.value as ContractType)}
        className="rounded-md border border-grey-100 px-3 py-2 text-sm text-grey-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="nda">NDA</option>
        <option value="msa">MSA</option>
      </select>
    </div>
  )
}
