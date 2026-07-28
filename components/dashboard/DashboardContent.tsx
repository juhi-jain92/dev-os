'use client'

import { useState } from 'react'
import { useUser } from '@/lib/supabase/provider'
import { useContracts, type ContractSortOrder } from '@/lib/queries/use-contracts'
import { SummaryCard } from './SummaryCard'
import { ContractHistoryTable } from './ContractHistoryTable'
import { EmptyDashboardState } from './EmptyDashboardState'

export function DashboardContent() {
  const { user } = useUser()
  const [sortOrder, setSortOrder] = useState<ContractSortOrder>('created_at.desc')
  const { data: contracts, isLoading } = useContracts(user?.id, sortOrder)

  if (isLoading) {
    return <p className="text-sm text-grey-500">Loading…</p>
  }

  if (!contracts || contracts.length === 0) {
    return <EmptyDashboardState />
  }

  return (
    <div className="flex flex-col gap-6">
      <SummaryCard contracts={contracts} />
      <ContractHistoryTable contracts={contracts} sortOrder={sortOrder} onSortChange={setSortOrder} />
    </div>
  )
}
