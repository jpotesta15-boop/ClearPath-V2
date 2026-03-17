'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { signupSchema, type SignupInput } from '@/lib/validations'

type FieldErrors = Partial<Record<keyof SignupInput, string>>

export function SignupForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setFieldErrors({})

    const parsed = signupSchema.safeParse({
      firstName: firstName.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    })

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      setFieldErrors({
        firstName: flat.firstName?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
        confirmPassword: flat.confirmPassword?.[0],
      })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.firstName },
        },
      })

      if (signUpError) {
        const msg = signUpError.message ?? 'Could not create account.'
        if (
          msg.includes('already') ||
          msg.includes('registered') ||
          msg.includes('exists')
        ) {
          setSubmitError('An account with this email already exists.')
        } else if (msg.includes('Password') || msg.includes('password')) {
          setFieldErrors((e) => ({ ...e, password: msg }))
        } else {
          setSubmitError(msg)
        }
        setLoading(false)
        return
      }

      if (signUpData?.session) {
        const completeRes = await fetch('/api/auth/signup-complete', {
          method: 'POST',
          credentials: 'include',
        })
        const completeJson = await completeRes.json()
        if (!completeRes.ok) {
          if (completeRes.status === 429) {
            setSubmitError(
              completeJson.error ?? 'Too many signup attempts. Please try again in 15 minutes.'
            )
          } else {
            setSubmitError(completeJson.error ?? 'Something went wrong — please try again.')
          }
          setLoading(false)
          return
        }
        router.push('/onboarding')
        router.refresh()
        return
      }

      if (signUpData?.user?.id) {
        const confirmRes = await fetch('/api/auth/confirm-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: signUpData.user.id }),
        })
        const confirmJson = await confirmRes.json()
        if (confirmRes.ok) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          })
          if (!signInErr) {
            const completeRes = await fetch('/api/auth/signup-complete', {
              method: 'POST',
              credentials: 'include',
            })
            if (completeRes.ok) {
              router.push('/onboarding')
              router.refresh()
              setLoading(false)
              return
            }
          }
        }
        setSubmitError(
          confirmJson.error ??
            'Account created. Confirm your email (check spam), or in Supabase: Authentication → Users → select your user → Confirm user, then sign in.'
        )
      } else {
        setSubmitError(
          'Account created. Confirm your email (check spam), or in Supabase: Authentication → Users → select your user → Confirm user, then sign in.'
        )
      }
    } catch {
      setSubmitError('Something went wrong — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            First name <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
            placeholder="Jane"
            aria-invalid={!!fieldErrors.firstName}
            aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
          />
          {fieldErrors.firstName && (
            <p id="firstName-error" className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.firstName}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
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
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            Password <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
            placeholder="••••••••"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && (
            <p id="password-error" className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            Confirm password <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
            placeholder="••••••••"
            aria-invalid={!!fieldErrors.confirmPassword}
            aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
          />
          {fieldErrors.confirmPassword && (
            <p id="confirmPassword-error" className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>
        {submitError && (
          <p className="rounded-lg bg-[var(--color-error-light)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-medium text-white hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:opacity-70 min-h-[44px]"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--color-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
