'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function isSafeNext(next: string | null): next is string {
  if (!next || typeof next !== 'string') return false
  try {
    const path = new URL(next, 'http://localhost').pathname
    return path.startsWith('/coach/') || path.startsWith('/client/')
  } catch {
    return false
  }
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      const msg = signInError.message ?? ''
      if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        setError('Too many failed sign-in attempts. Please try again in 15 minutes.')
      } else if (
        msg.toLowerCase().includes('email') && msg.toLowerCase().includes('confirm')
      ) {
        setError(
          'Your email isn’t confirmed yet. Check your spam folder for the confirmation link, or in Supabase Dashboard go to Authentication → Users, select your user, and choose Confirm user — then try signing in again.'
        )
      } else {
        setError('Invalid email or password. Please try again.')
      }
      return
    }
    const next = isSafeNext(nextParam) ? nextParam : undefined
    router.push(next ?? '/')
    router.refresh()
  }

  const rateLimitMessage = searchParams.get('error') === 'rate_limit'
    ? 'Too many failed sign-in attempts. Please try again in 15 minutes.'
    : null
  const passwordResetMessage = searchParams.get('message') === 'password_reset'
    ? 'Your password has been updated. Sign in with your new password.'
    : null

  return (
    <div className="flex flex-col gap-6">
      {rateLimitMessage && (
        <p className="rounded-lg bg-[var(--color-error-light)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
          {rateLimitMessage}
        </p>
      )}
      {passwordResetMessage && !rateLimitMessage && (
        <p className="rounded-lg bg-[var(--color-accent-light)] px-4 py-3 text-sm text-[var(--color-accent)]" role="status">
          {passwordResetMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
            Email <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-primary)]">
              Password <span className="text-[var(--color-error)]">*</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-medium text-white hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:opacity-70 min-h-[44px]"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[var(--color-accent)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
