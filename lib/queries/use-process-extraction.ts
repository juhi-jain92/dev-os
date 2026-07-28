'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface ProcessExtractionResult {
  contract_id: string
  status: string
  term_count: number
}

export function useProcessExtraction(contractId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customTerms: string[]): Promise<ProcessExtractionResult> => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-extraction`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contract_id: contractId, custom_terms: customTerms }),
        }
      )
      const body = await response.json()
      if (!response.ok) throw body
      return body as ProcessExtractionResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    },
  })
}
