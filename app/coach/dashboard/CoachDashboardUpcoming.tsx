'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

type Session = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  clients: { first_name: string | null; last_name: string | null } | null
}

export function CoachDashboardUpcoming() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/coach/sessions')
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.data)) setSessions(json.data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Upcoming sessions</h2>
        <Link
          href="/coach/schedule"
          className="text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          Go to calendar
        </Link>
      </div>
      {loading ? (
        <ul className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-surface)]" />
          ))}
        </ul>
      ) : sessions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="font-medium text-[var(--color-text-primary)]">No upcoming sessions</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Book a session from your calendar.</p>
          <Link
            href="/coach/schedule"
            className="mt-3 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Go to calendar
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {sessions.map((s) => {
            const name = [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'
            const start = parseISO(s.scheduled_time)
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              >
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{name}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {format(start, 'EEE, MMM d')} · {format(start, 'h:mm a')}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                  {s.status}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
