'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const THIRTY_MIN_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) break
    THIRTY_MIN_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

export interface AddAvailabilityModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function AddAvailabilityModal({ open, onClose, onSaved }: AddAvailabilityModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (endTime <= startTime) {
      setError('End time must be after start time')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek,
          startTime: startTime + ':00',
          endTime: endTime + ':00',
          label: label.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not save')
        setLoading(false)
        return
      }
      onSaved()
      onClose()
      setDayOfWeek(1)
      setStartTime('09:00')
      setEndTime('17:00')
      setLabel('')
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-availability-title">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg">
        <h2 id="add-availability-title" className="text-lg font-medium text-[var(--color-text-primary)]">
          Add availability
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Day of week <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
              required
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
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
              {THIRTY_MIN_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              End time <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
            >
              {THIRTY_MIN_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Morning sessions"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] min-h-[44px]"
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
