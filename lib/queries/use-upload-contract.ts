'use client'

import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ContractType } from '@/types/contract'

export interface UploadResult {
  contract_id: string
  status: string
  page_count: number
}

export interface UploadError {
  error: string
  message?: string
  max_mb?: number
  max_pages?: number
  actual_pages?: number
  max_tokens?: number
  retry_after_seconds?: number
}

export function useUploadContract(userId: string | undefined) {
  const queryClient = useQueryClient()

  async function upload(file: File, contractType: ContractType): Promise<UploadResult> {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('contract_type', contractType)

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-contract`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      }
    )

    const body = await response.json()

    if (!response.ok) {
      throw body as UploadError
    }

    queryClient.invalidateQueries({ queryKey: ['contracts', userId] })
    return body as UploadResult
  }

  return { upload }
}
