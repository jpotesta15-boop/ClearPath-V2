'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

export type SessionForDrawer = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  notes: string | null
  client_id: string
  clients: { first_name: string | null; last_name: string | null } | null
}

export interface SessionDetailDrawerProps {
  session: SessionForDrawer | null
  onClose: () => void
  onUpdated: () => void
}

export function SessionDetailDrawer({ session, onClose, onUpdated }: SessionDetailDrawerProps) {
  const [notes, setNotes] = useState(session?.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  if (!session) return null

  const clientName = [session.clients?.first_name, session.clients?.last_name].filter(Boolean).join(' ') || 'Client'
  const start = new Date(session.scheduled_time)
  const end = session.end_time ? new Date(session.end_time) : session.duration_minutes ? new Date(start.getTime() + session.duration_minutes * 60 * 1000) : new Date(start.getTime() + 60 * 60 * 1000)
  const durationMins = session.duration_minutes ?? Math.round((end.getTime() - start.getTime()) / 60000)

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('sessions').update({ notes: notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', session.id)
      if (!error) onUpdated()
    } finally {
      setSavingNotes(false)
    }
  }

  const markComplete = async () => {
    setActionLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('sessions').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', session.id)
      if (!error) {
        onUpdated()
        onClose()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const cancelSession = async () => {
    setActionLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('sessions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', session.id)
      if (!error) {
        onUpdated()
        onClose()
        setConfirmCancel(false)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const statusVariant = session.status === 'confirmed' ? 'active' : session.status === 'completed' ? 'inactive' : 'pending'

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Session details</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Client</p>
          <Link href={`/coach/clients/${session.client_id}`} className="text-[var(--color-accent)] hover:underline font-medium">
            {clientName}
          </Link>
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Date & time</p>
          <p className="text-[var(--color-text-primary)]">{format(start, 'EEEE, MMM d, yyyy')} · {format(start, 'h:mm a')} – {format(end, 'h:mm a')}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{durationMins} min</p>
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Status</p>
          <Badge variant={statusVariant}>{session.status}</Badge>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            disabled={savingNotes}
            rows={3}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
            placeholder="Session notes…"
          />
        </div>
        {session.status === 'confirmed' && start > new Date() && (
          <div className="flex flex-col gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button onClick={markComplete} disabled={actionLoading} variant="secondary">
              Mark complete
            </Button>
            {!confirmCancel ? (
              <Button variant="destructive-secondary" onClick={() => setConfirmCancel(true)} disabled={actionLoading}>
                Cancel session
              </Button>
            ) : (
              <div className="rounded-lg bg-[var(--color-error-light)] p-3">
                <p className="text-sm text-[var(--color-error)] mb-2">Cancel this session?</p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={cancelSession} disabled={actionLoading}>
                    Cancel session
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                    Keep
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
