interface ExtractionProgressIndicatorProps {
  step: 1 | 2 | 3
}

const STEPS = ['Extracting text', 'Analysing with AI', 'Compiling results']

export function ExtractionProgressIndicator({ step }: ExtractionProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1
        const isActive = stepNumber <= step
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${isActive ? 'bg-blue-500' : 'bg-grey-200'}`} />
            <span className={`text-[12px] ${isActive ? 'text-grey-900' : 'text-grey-500'}`}>{label}</span>
            {stepNumber < STEPS.length && <div className="h-0.5 w-6 bg-grey-200" />}
          </div>
        )
      })}
    </div>
  )
}
