'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[24px]">
      {children}
    </div>
  )
}

export default function OnboardingStep4Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleGoToDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces/complete-onboarding', { method: 'PATCH' })
      if (!res.ok) {
        setLoading(false)
        return
      }
      router.push('/coach/dashboard')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[var(--text-h3)] font-medium tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]">
          You&apos;re ready to go
        </h1>
        <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">
          Here&apos;s what you can do first
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/coach/clients" className="block">
          <Card variant="raised" padding="lg" className="h-full transition-colors hover:border-[var(--color-accent)]">
            <CardIcon>👤</CardIcon>
            <CardTitle className="mb-1">Add a client</CardTitle>
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              Add clients and manage their profiles and access.
            </p>
            <Button variant="secondary" className="mt-4 w-full">
              Add a client
            </Button>
          </Card>
        </Link>
        <Link href="/coach/programs" className="block">
          <Card variant="raised" padding="lg" className="h-full transition-colors hover:border-[var(--color-accent)]">
            <CardIcon>📋</CardIcon>
            <CardTitle className="mb-1">Create a program</CardTitle>
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              Build programs and assign them to clients.
            </p>
            <Button variant="secondary" className="mt-4 w-full">
              Create a program
            </Button>
          </Card>
        </Link>
        <Link href="/coach/videos" className="block">
          <Card variant="raised" padding="lg" className="h-full transition-colors hover:border-[var(--color-accent)]">
            <CardIcon>🎬</CardIcon>
            <CardTitle className="mb-1">Add videos</CardTitle>
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              Set your import folder and upload videos from your phone or computer.
            </p>
            <Button variant="secondary" className="mt-4 w-full">
              Go to Videos
            </Button>
          </Card>
        </Link>
      </div>

      <div className="pt-4">
        <Button onClick={handleGoToDashboard} disabled={loading} fullWidth>
          {loading ? 'Loading…' : 'Go to dashboard'}
        </Button>
      </div>
    </div>
  )
}
