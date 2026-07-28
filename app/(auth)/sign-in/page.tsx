'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setStatus('submitting')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setStatus('idle')
      const message = signInError.message.toLowerCase()
      if (message.includes('email not confirmed')) {
        setError('Please verify your email before signing in — check your inbox.')
      } else {
        setError('Invalid email or password.')
      }
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-grey-900">Sign In</h1>
          <p className="mt-2 text-sm font-normal leading-[18px] text-grey-500">
            Welcome back — pick up where you left off.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-grey-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-grey-100 px-3 py-2 text-base text-grey-900 outline-none transition-colors focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-grey-900">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-grey-100 px-3 py-2 text-base text-grey-900 outline-none transition-colors focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn-primary mt-2 w-full text-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-normal text-grey-500">
          Don&apos;t have an account?{' '}
          <a href="/sign-up" className="font-medium text-blue-500">
            Get started free
          </a>
        </p>
      </div>
    </main>
  )
}
