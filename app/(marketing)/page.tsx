export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4 py-24 text-center sm:px-28">
      <div className="flex max-w-2xl flex-col items-center gap-6">
        <span className="rounded-sm border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          NDA &amp; MSA review, in minutes
        </span>

        <h1 className="text-4xl font-bold leading-tight text-grey-900 sm:text-5xl">
          Know exactly what you&apos;re signing
        </h1>

        <p className="max-w-xl text-base font-medium leading-6 text-grey-500">
          ContractIQ extracts the key terms from your NDAs and MSAs, tells you exactly which
          page each one came from, scores how confident it is, and lets you ask follow-up
          questions in plain English — no lawyer on call required.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <a href="/sign-up" className="btn-primary">
            Get Started Free
          </a>
          <a href="/sign-in" className="btn-ghost">
            Sign In
          </a>
        </div>

        <p className="mt-8 text-xs font-normal leading-[18px] text-grey-300">
          ContractIQ is an AI-assisted review tool, not legal advice.
        </p>
      </div>
    </main>
  )
}
