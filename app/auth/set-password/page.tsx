'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

const MIN_PASSWORD_LENGTH = 8

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [noSession, setNoSession] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})

  useEffect(() => {
    const supabase = createClient()
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
        setNoSession(false)
        return
      }
      if (typeof window !== 'undefined' && window.location.hash) {
        await new Promise((r) => setTimeout(r, 400))
        const { data: { session: retry } } = await supabase.auth.getSession()
        if (retry) {
          setSessionReady(true)
          setNoSession(false)
          return
        }
      }
      setNoSession(true)
    }
    checkSession()
  }, [])

  const validate = (): boolean => {
    const errs: { password?: string; confirm?: string } = {}
    if (password.length < MIN_PASSWORD_LENGTH) {
      errs.password = 'Password must be at least 8 characters'
    }
    if (password !== confirmPassword) {
      errs.confirm = 'Passwords do not match'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not set password')
        setSubmitting(false)
        return
      }
      router.replace('/client/portal')
      return
    } catch {
      setError('Something went wrong — check your connection and try again')
      setSubmitting(false)
    }
  }

  if (!sessionReady && !noSession) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-surface)]">
        <p className="text-[var(--color-muted)]">Loading…</p>
      </main>
    )
  }

  if (noSession) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-surface)]">
        <Card variant="raised" padding="lg" className="w-full max-w-md">
          <h1 className="text-lg font-medium text-[var(--color-ink)]">Invalid or expired link</h1>
          <p className="mt-2 text-[15px] text-[var(--color-muted)]">
            This set-password link may have expired. Ask your coach to send a new invite.
          </p>
          <Link href="/login" className="mt-4 inline-block">
            <Button variant="primary">Go to login</Button>
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-surface)]">
      <Card variant="raised" padding="lg" className="w-full max-w-md">
        <h1 className="text-lg font-medium text-[var(--color-ink)]">Set your password</h1>
        <p className="mt-1 text-[15px] text-[var(--color-muted)]">
          Choose a password to sign in to your client portal.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-[14px] font-medium text-[var(--color-text-primary)] mb-1">
              New password <span className="text-[var(--color-error)]">*</span>
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={submitting}
              error={!!fieldErrors.password}
              errorMessage={fieldErrors.password}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-[14px] font-medium text-[var(--color-text-primary)] mb-1">
              Confirm password <span className="text-[var(--color-error)]">*</span>
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Same as above"
              disabled={submitting}
              error={!!fieldErrors.confirm}
              errorMessage={fieldErrors.confirm}
            />
          </div>
          {error && (
            <p className="text-[14px] text-[var(--color-error)]">{error}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={submitting}
            className="min-h-[44px]"
          >
            {submitting ? 'Setting password…' : 'Set password'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
