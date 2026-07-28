import { DashboardContent } from '@/components/dashboard/DashboardContent'

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-28">
      <h1 className="text-2xl font-semibold text-grey-900">Dashboard</h1>
      <div className="mt-8">
        <DashboardContent />
      </div>
    </main>
  )
}
