import type { ChatMessage } from '../../types/chat'

const SOURCE_LABEL: Record<NonNullable<ChatMessage['context_source']>, string> = {
  contract: 'From contract',
  history: 'From conversation',
  both: 'From contract & conversation',
}

interface ChatMessageBubbleProps {
  message: ChatMessage
  onPageClick?: (page: number) => void
}

export function ChatMessageBubble({ message, onPageClick }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser ? 'bg-blue-50 text-grey-900' : 'bg-grey-25 text-grey-900'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        {!isUser && message.context_source && (
          <div className="mt-2 flex items-center gap-2 text-[12px] leading-[18px] text-grey-500">
            <span>{SOURCE_LABEL[message.context_source]}</span>
            {message.page_citation !== null && (
              <button
                type="button"
                className="text-blue-500 no-underline hover:underline"
                onClick={() => onPageClick?.(message.page_citation as number)}
              >
                Page {message.page_citation}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
