'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatMessages } from '@/lib/queries/use-chat-messages'
import { ChatMessageBubble } from './ChatMessageBubble'
import type { ChatMessage } from '@/types/chat'

interface ChatPanelProps {
  contractId: string
}

export function ChatPanel({ contractId }: ChatPanelProps) {
  const { data: history, isLoading: isLoadingHistory } = useChatMessages(contractId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (history) setMessages(history)
  }, [history])

  async function handleSend() {
    const text = draft.trim()
    if (!text || isSending) return

    setIsSending(true)
    setDraft('')

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        session_id: '',
        user_id: '',
        role: 'user',
        content: text,
        page_citation: null,
        context_source: null,
        created_at: new Date().toISOString(),
      },
    ])

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contract_id: contractId, message: text }),
      })
      const body = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          id: response.ok ? body.message_id : crypto.randomUUID(),
          session_id: '',
          user_id: '',
          role: 'assistant',
          content: response.ok ? body.content : `Error: ${body.error ?? 'something went wrong'}`,
          page_citation: response.ok ? body.page_citation : null,
          context_source: response.ok ? body.context_source : null,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-white p-6">
      <h2 className="text-base font-medium text-grey-900">Ask about this contract</h2>
      <div className="flex min-h-[200px] flex-col gap-3">
        {isLoadingHistory && <p className="text-sm text-grey-500">Loading conversation…</p>}
        {!isLoadingHistory && messages.length === 0 && (
          <p className="text-sm text-grey-500">Ask a question about this contract to get started.</p>
        )}
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
        {isSending && <p className="text-sm text-grey-500">Thinking…</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="Ask a question…"
          disabled={isSending}
          className="flex-1 rounded-md border border-grey-100 px-3 py-2 text-sm text-grey-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
