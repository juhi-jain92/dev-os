import Link from 'next/link'

export function EmptyDashboardState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-white py-24 text-center">
      <p className="text-sm text-grey-500">No contracts reviewed yet — upload your first contract to begin</p>
      <Link
        href="/upload"
        className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
      >
        Review a Contract
      </Link>
    </div>
  )
}
