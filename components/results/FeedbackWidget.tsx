'use client'

import { useState } from 'react'
import { useSubmitFeedback } from '@/lib/queries/use-submit-feedback'

interface FeedbackWidgetProps {
  contractId: string
}

const MAX_COMMENT_LENGTH = 1000

export function FeedbackWidget({ contractId }: FeedbackWidgetProps) {
  const { mutate, isPending } = useSubmitFeedback()
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleRate(value: 'up' | 'down') {
    setRating(value)
    setShowComment(true)
  }

  function handleSubmit() {
    if (!rating) return
    mutate(
      { contractId, rating, comment: comment.trim() || undefined },
      { onSuccess: () => setSubmitted(true) }
    )
  }

  if (submitted) {
    return <p className="text-sm text-grey-500">Thanks for your feedback.</p>
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleRate('up')}
          aria-pressed={rating === 'up'}
          className={`rounded-md p-2 text-lg ${rating === 'up' ? 'text-blue-500' : 'text-grey-400'}`}
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => handleRate('down')}
          aria-pressed={rating === 'down'}
          className={`rounded-md p-2 text-lg ${rating === 'down' ? 'text-blue-500' : 'text-grey-400'}`}
        >
          👎
        </button>
      </div>

      {showComment && (
        <div className="flex flex-col gap-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Add a comment (optional)"
            className="rounded-md border border-grey-100 px-3 py-2 text-sm text-grey-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <span className="self-end text-[12px] text-grey-500">
            {comment.length}/{MAX_COMMENT_LENGTH}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="self-start rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  )
}
