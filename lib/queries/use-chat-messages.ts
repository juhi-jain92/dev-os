'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage } from '@/types/chat'

export function useChatMessages(contractId: string) {
  return useQuery({
    queryKey: ['chat-messages', contractId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const supabase = createClient()

      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('contract_id', contractId)
        .single()

      if (!session) return []

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })

      if (error) return []
      return messages as ChatMessage[]
    },
  })
}
