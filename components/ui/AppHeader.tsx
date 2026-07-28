'use client'

import Link from 'next/link'
import { useUser } from '@/lib/supabase/provider'
import { SignOutButton } from './SignOutButton'

export function AppHeader() {
  const { user, isLoading } = useUser()

  return (
    <header className="border-b border-grey-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500 text-white">📄</span>
          <span className="text-base font-semibold text-grey-900">ContractIQ</span>
        </Link>

        {!isLoading && user && (
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-grey-500 hover:text-grey-900"
            >
              Dashboard
            </Link>
            <Link
              href="/upload"
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              + Review a Contract
            </Link>
            <span className="text-sm text-grey-500">{user.email}</span>
            <SignOutButton />
          </div>
        )}

        {!isLoading && !user && (
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium text-grey-500 hover:text-grey-900">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Get Started Free
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
