'use client'

import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'

export type InvoiceCardDataClient = {
  type: 'invoice'
  invoiceId: string
  packageTitle: string
  packageDescription?: string | null
  amountCents: number
  currency: string
  status: string
  dueDate?: string | null
  paidAt?: string | null
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

export function InvoiceCardClient({ data }: { data: InvoiceCardDataClient }) {
  const isPaid = data.status === 'paid'
  const isCancelled = data.status === 'cancelled'

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 min-w-[260px] max-w-[320px]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-[var(--color-ink)]">{data.packageTitle}</h4>
        <Badge
          variant={
            isPaid ? 'active' : isCancelled ? 'inactive' : 'pending'
          }
        >
          {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
        </Badge>
      </div>
      {data.packageDescription && (
        <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">
          {data.packageDescription}
        </p>
      )}
      <p className="mt-2 text-lg font-medium text-[var(--color-ink)]">
        {formatAmount(data.amountCents, data.currency)}
      </p>
      {data.dueDate && !isPaid && !isCancelled && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Due {format(new Date(data.dueDate), 'MMM d, yyyy')}
        </p>
      )}
      {isPaid && data.paidAt && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Paid · {format(new Date(data.paidAt), 'MMM d, yyyy')}
        </p>
      )}
      {!isPaid && !isCancelled && (
        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-white p-3">
          <p className="text-sm font-medium text-[var(--color-ink)]">Pay</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Contact your coach to complete payment. You can reply in this thread or use their preferred payment method.
          </p>
        </div>
      )}
    </div>
  )
}
