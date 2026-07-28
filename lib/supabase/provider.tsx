'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// Exposes the current Supabase auth user to client components.
// See docs/specs/auth-spec.md — State Management (Frontend).
type SupabaseAuthContext = {
  user: User | null
  isLoading: boolean
}

const Context = createContext<SupabaseAuthContext>({ user: null, isLoading: true })

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <Context.Provider value={{ user, isLoading }}>{children}</Context.Provider>
}

export function useUser() {
  return useContext(Context)
}
