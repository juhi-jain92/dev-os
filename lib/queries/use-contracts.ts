'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contract } from '@/types/contract'

export type ContractSortOrder = 'created_at.desc' | 'file_name.asc' | 'contract_type.asc'

export type ContractSummary = Pick<Contract, 'id' | 'file_name' | 'contract_type' | 'status' | 'created_at'>

const SORT_COLUMNS: Record<ContractSortOrder, { column: string; ascending: boolean }> = {
  'created_at.desc': { column: 'created_at', ascending: false },
  'file_name.asc': { column: 'file_name', ascending: true },
  'contract_type.asc': { column: 'contract_type', ascending: true },
}

export function useContracts(userId: string | undefined, sortOrder: ContractSortOrder) {
  return useQuery({
    queryKey: ['contracts', userId, sortOrder],
    queryFn: async (): Promise<ContractSummary[]> => {
      const supabase = createClient()
      const { column, ascending } = SORT_COLUMNS[sortOrder]

      const { data, error } = await supabase
        .from('contracts')
        .select('id, file_name, contract_type, status, created_at')
        .order(column, { ascending })
        .order('id', { ascending: true })

      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
  })
}
