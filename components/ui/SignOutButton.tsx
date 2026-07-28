'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="rounded-md px-3 py-2 text-sm font-medium text-grey-500 transition-colors hover:text-grey-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSigningOut ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
