interface ConfidenceBadgeProps {
  score: number
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const tier = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'

  const classes = {
    high: 'bg-green-50 border-green-200 text-green-700',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    low: 'bg-red-50 border-red-200 text-red-700',
  }[tier]

  return (
    <span className="flex items-center gap-1">
      {tier === 'low' && <span aria-hidden="true">⚠️</span>}
      <span className={`rounded border px-2 py-0.5 text-[12px] font-medium ${classes}`}>
        {Math.round(score)}%
      </span>
    </span>
  )
}
