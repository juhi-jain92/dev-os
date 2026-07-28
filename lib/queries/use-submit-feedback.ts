'use client'

import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface SubmitFeedbackInput {
  contractId: string
  rating: 'up' | 'down'
  comment?: string
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async ({ contractId, rating, comment }: SubmitFeedbackInput) => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-feedback`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contract_id: contractId, rating, comment }),
        }
      )
      const body = await response.json()
      if (!response.ok) throw body
      return body as { id: string }
    },
  })
}
