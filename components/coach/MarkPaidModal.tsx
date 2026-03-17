'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const PAYMENT_METHODS: { value: string; label: string; comingSoon?: boolean }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
  { value: 'stripe', label: 'Stripe', comingSoon: true },
]

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

export function MarkPaidModal({
  isOpen,
  onClose,
  invoiceId,
  clientName,
  amountCents,
  currency,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  clientName: string
  amountCents: number
  currency: string
  onSuccess: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [paymentReference, setPaymentReference] = useState('')
  const [amountDisplay, setAmountDisplay] = useState((amountCents / 100).toFixed(2))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = paymentMethod as string
    if (!method || method === 'stripe') {
      setError('Please select a payment method')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const cents = Math.round(parseFloat(amountDisplay || '0') * 100) || amountCents
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: method as 'cash' | 'zelle' | 'venmo' | 'cashapp' | 'paypal' | 'bank_transfer' | 'other',
          paymentReference: paymentReference.trim() || null,
          paymentMethodNote: null,
          amountCents: cents,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not record payment')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record payment from ${clientName}`}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Payment method *
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[15px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
            required
            aria-required
          >
            <option value="">Select method</option>
            {PAYMENT_METHODS.map((m) => (
              <option
                key={m.value}
                value={m.value}
                disabled={m.comingSoon}
                className={m.comingSoon ? 'text-[var(--color-muted)]' : ''}
              >
                {m.label}
                {m.comingSoon ? ' (coming soon)' : ''}
              </option>
            ))}
          </select>
          {PAYMENT_METHODS.find((m) => m.value === 'stripe' && m.comingSoon) && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Stripe option will be available in a future update.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Transaction ID, confirmation #, or note
          </label>
          <Input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Optional"
            className="w-full"
            maxLength={500}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Amount
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amountDisplay}
            onChange={(e) => setAmountDisplay(e.target.value)}
            placeholder={formatAmount(amountCents, currency)}
            className="w-full"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Pre-filled: {formatAmount(amountCents, currency)}
          </p>
        </div>
        {error && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Recording…' : 'Mark as paid'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
