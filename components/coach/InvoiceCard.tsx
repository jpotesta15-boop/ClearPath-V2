'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MarkPaidModal } from './MarkPaidModal'
import { format } from 'date-fns'

export type InvoiceCardData = {
  type: 'invoice'
  invoiceId: string
  packageTitle: string
  packageDescription?: string | null
  amountCents: number
  currency: string
  status: string
  dueDate?: string | null
  paymentMethod?: string | null
  paidAt?: string | null
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  zelle: 'Zelle',
  venmo: 'Venmo',
  cashapp: 'CashApp',
  paypal: 'PayPal',
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  other: 'Other',
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

export function InvoiceCard({
  data,
  clientName,
  onPaymentRecorded,
}: {
  data: InvoiceCardData
  clientName: string
  onPaymentRecorded?: () => void
}) {
  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const isPaid = data.status === 'paid'
  const isCancelled = data.status === 'cancelled'

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 min-w-[260px] max-w-[320px]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-[var(--color-ink)]">{data.packageTitle}</h4>
        <span className="shrink-0">
          <Badge
            variant={
              isPaid ? 'active' : isCancelled ? 'inactive' : 'pending'
            }
          >
            {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
          </Badge>
        </span>
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
      {isPaid && data.paymentMethod && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Paid via {PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod}
          {data.paidAt && ` · ${format(new Date(data.paidAt), 'MMM d, yyyy')}`}
        </p>
      )}
      {!isPaid && !isCancelled && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full min-h-[44px]"
          onClick={() => setMarkPaidOpen(true)}
        >
          Mark as paid
        </Button>
      )}
      <MarkPaidModal
        isOpen={markPaidOpen}
        onClose={() => setMarkPaidOpen(false)}
        invoiceId={data.invoiceId}
        clientName={clientName}
        amountCents={data.amountCents}
        currency={data.currency}
        onSuccess={() => {
          setMarkPaidOpen(false)
          onPaymentRecorded?.()
        }}
      />
    </div>
  )
}
