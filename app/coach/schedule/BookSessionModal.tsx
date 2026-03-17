'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

type Client = { id: string; first_name: string | null; last_name: string | null }

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) break
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

const DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
]

export interface BookSessionModalProps {
  open: boolean
  onClose: () => void
  onBooked: () => void
}

export function BookSessionModal({ open, onClose, onBooked }: BookSessionModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setClientsLoading(true)
    fetch('/api/clients')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setClients(json.data)
          if (json.data.length && !clientId) setClientId(json.data[0].id)
        }
      })
      .finally(() => setClientsLoading(false))
  }, [open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!clientId || !date || !startTime) {
      setError('Please select a client, date, and time')
      return
    }
    const [h, min] = startTime.split(':').map(Number)
    const scheduled = new Date(date)
    scheduled.setHours(h, min, 0, 0)
    const scheduled_time = scheduled.toISOString()

    setLoading(true)
    try {
      const res = await fetch('/api/coach/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          scheduled_time,
          duration_minutes: durationMinutes,
          notes: notes.trim() || null,
          status: 'confirmed',
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        setError(json.error ?? 'You already have a session at this time. Pick another time.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not book session')
        setLoading(false)
        return
      }
      onBooked()
      onClose()
      setError(null)
      setDate('')
      setStartTime('10:00')
      setDurationMinutes(60)
      setNotes('')
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="book-session-title">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg">
        <h2 id="book-session-title" className="text-lg font-medium text-[var(--color-text-primary)]">
          Book session
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Client <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
              required
              disabled={clientsLoading}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Date <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Start time <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Duration
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
            >
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session focus, goals…"
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] resize-y"
              maxLength={2000}
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || clientsLoading}>
              {loading ? 'Booking…' : 'Book session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
