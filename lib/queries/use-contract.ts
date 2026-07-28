'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contract } from '@/types/contract'
import type { KeyTerm, CustomKeyTerm } from '@/types/key-term'

export interface ContractWithTerms extends Contract {
  key_terms: KeyTerm[]
  custom_key_terms: CustomKeyTerm[]
}

export function useContract(contractId: string) {
  return useQuery({
    queryKey: ['contract', contractId],
    queryFn: async (): Promise<ContractWithTerms | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contracts')
        .select('*, key_terms(*), custom_key_terms(*)')
        .eq('id', contractId)
        .single()

      if (error) return null
      return data as ContractWithTerms
    },
  })
}

export function useSignedPdfUrl(filePath: string | null) {
  return useQuery({
    queryKey: ['signed-pdf-url', filePath],
    queryFn: async (): Promise<string | null> => {
      if (!filePath) return null
      const supabase = createClient()
      const { data, error } = await supabase.storage.from('contracts').createSignedUrl(filePath, 3600)
      if (error) return null
      return data.signedUrl
    },
    enabled: !!filePath,
  })
}
