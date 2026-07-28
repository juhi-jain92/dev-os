'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { TermTable } from '@/types/key-term'
import type { ContractWithTerms } from './use-contract'

interface UpdateKeyTermInput {
  id: string
  table: TermTable
  value: string
}

export function useUpdateKeyTerm(contractId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, table, value }: UpdateKeyTermInput) => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/update-key-term`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id, table, value }),
        }
      )
      const body = await response.json()
      if (!response.ok) throw body
      return body
    },
    onMutate: async ({ id, table, value }) => {
      await queryClient.cancelQueries({ queryKey: ['contract', contractId] })
      const previous = queryClient.getQueryData<ContractWithTerms>(['contract', contractId])

      queryClient.setQueryData<ContractWithTerms>(['contract', contractId], (old) => {
        if (!old) return old
        return {
          ...old,
          [table]: old[table].map((term) => (term.id === id ? { ...term, value } : term)),
        }
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['contract', contractId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    },
  })
}
