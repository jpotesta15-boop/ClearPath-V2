'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'

type Session = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  notes: string | null
}

export function ClientSessionsContent() {
  const [upcoming, setUpcoming] = useState<Session[]>([])
  const [past, setPast] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    setLoading(true)
    fetch('/api/client/sessions')
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setUpcoming(json.data.upcoming ?? [])
          setPast(json.data.past ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const calendarUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/feed/client` : '/api/calendar/feed/client'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-medium text-[var(--color-ink)]">Sessions</h1>
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          download="my-sessions.ics"
          className="inline-flex items-center justify-center min-h-10 h-10 rounded-lg px-4 text-sm font-medium border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
        >
          Add to Google Calendar
        </a>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        Subscribe to your sessions or download the calendar file and import it into Google Calendar.
      </p>

      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setTab('upcoming')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px min-h-[44px] ${
            tab === 'upcoming'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setTab('past')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px min-h-[44px] ${
            tab === 'past'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Past
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-surface)]" />
          ))}
        </div>
      ) : tab === 'upcoming' ? (
        upcoming.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <h2 className="font-medium text-[var(--color-ink)]">No upcoming sessions</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">When your coach books a session, it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </ul>
        )
      ) : past.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <h2 className="font-medium text-[var(--color-ink)]">No past sessions</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Your completed sessions will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {past.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: Session }) {
  const start = parseISO(session.scheduled_time)
  const end = session.end_time ? parseISO(session.end_time) : session.duration_minutes
    ? new Date(start.getTime() + session.duration_minutes * 60 * 1000)
    : new Date(start.getTime() + 60 * 60 * 1000)
  const statusVariant =
    session.status === 'confirmed' ? 'confirmed' :
    session.status === 'completed' ? 'completed' :
    session.status === 'cancelled' ? 'cancelled' : 'pending'

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--color-ink)]">
            {format(start, 'EEEE, MMM d, yyyy')}
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
          </p>
          {session.notes && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">{session.notes}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            statusVariant === 'confirmed'
              ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
              : statusVariant === 'completed'
              ? 'bg-[var(--color-border)] text-[var(--color-muted)]'
              : statusVariant === 'cancelled'
              ? 'bg-[var(--color-error-light)] text-[var(--color-error)]'
              : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
          }`}
        >
          {session.status}
        </span>
      </div>
    </li>
  )
}
