'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type ClientProgram = {
  clientProgramId: string
  programId: string
  title: string
  status: string
  totalModules: number
  modulesCompleted: number
}

export function ClientPortalProgramCard() {
  const [program, setProgram] = useState<ClientProgram | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/client/programs')
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.length) {
          const active = json.data.find((p: ClientProgram) => p.status === 'active')
          setProgram(active ?? json.data[0])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card variant="raised" padding="lg">
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
          My Program
        </h2>
        <p className="text-[14px] text-[var(--color-muted)]">Loading…</p>
      </Card>
    )
  }

  if (!program) {
    return (
      <Card variant="raised" padding="lg">
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
          My Program
        </h2>
        <p className="text-[14px] text-[var(--color-muted)] flex items-center gap-2">
          <span aria-hidden>📋</span>
          No program assigned yet
        </p>
      </Card>
    )
  }

  const pct =
    program.totalModules > 0
      ? Math.round((program.modulesCompleted / program.totalModules) * 100)
      : 0

  return (
    <Card variant="raised" padding="lg">
      <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
        My Program
      </h2>
      <p className="text-[14px] text-[var(--color-ink)] font-medium">{program.title}</p>
      <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        {program.modulesCompleted} of {program.totalModules} modules complete
      </p>
      <Link href={`/client/programs/${program.programId}`} className="block mt-3">
        <Button variant="secondary" className="w-full min-h-[44px]">
          Continue
        </Button>
      </Link>
    </Card>
  )
}
