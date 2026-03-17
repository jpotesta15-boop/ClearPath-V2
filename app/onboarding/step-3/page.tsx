'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function OnboardingStep3Page() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null)

  useEffect(() => {
    if (inviteSentTo === null) return
    const t = setTimeout(() => router.push('/onboarding/step-4'), 1500)
    return () => clearTimeout(t)
  }, [inviteSentTo, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const resCreate = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
        }),
      })
      const jsonCreate = await resCreate.json()
      if (!resCreate.ok) {
        setError(jsonCreate.error || 'Could not add client')
        setSubmitting(false)
        return
      }
      const resInvite = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const jsonInvite = await resInvite.json()
      if (!resInvite.ok) {
        setError(jsonInvite.error || 'Client added but invite could not be sent')
        setSubmitting(false)
        return
      }
      setInviteSentTo(email.trim().toLowerCase())
    } catch {
      setError('Something went wrong — try again')
      setSubmitting(false)
    }
  }

  if (inviteSentTo) {
    return (
      <div className="space-y-6">
        <h1 className="text-[var(--text-h3)] font-medium tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]">
          Invite your first client
        </h1>
        <p className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success-light)] px-4 py-3 text-[var(--color-text-primary)]">
          Invite sent to {inviteSentTo}
        </p>
        <p className="text-[var(--color-text-secondary)]">Taking you to the next step…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-[var(--text-h3)] font-medium tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]">
        Invite your first client
      </h1>
      <p className="text-[15px] text-[var(--color-text-secondary)]">
        You can always do this later
      </p>

      <div>
        <label htmlFor="first-name" className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          First name
        </label>
        <Input
          id="first-name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="w-full"
        />
      </div>
      <div>
        <label htmlFor="last-name" className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          Last name
        </label>
        <Input
          id="last-name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="w-full"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
        />
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send invite'}
        </Button>
        <Link
          href="/onboarding/step-4"
          className="text-center text-[15px] font-medium text-[var(--color-accent)] hover:underline"
        >
          Skip for now
        </Link>
        <Link
          href="/onboarding/step-2"
          className="text-center text-[15px] text-[var(--color-text-secondary)] hover:underline"
        >
          Back
        </Link>
      </div>
    </form>
  )
}
