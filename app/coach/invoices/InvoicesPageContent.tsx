'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type ClientRow = { id: string; first_name: string | null; last_name: string | null; email: string | null }
type PackageRow = { id: string; title: string | null; description: string | null }
type InvoiceRow = {
  id: string
  amount_cents: number
  currency: string
  status: string
  payment_method: string | null
  payment_method_note: string | null
  payment_reference: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
  session_packages: PackageRow | null
  clients: ClientRow | null
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

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function clientName(clients: ClientRow | null): string {
  if (!clients) return '—'
  const name = [clients.first_name, clients.last_name].filter(Boolean).join(' ')
  return name || clients.email || '—'
}

function exportToCsv(invoices: InvoiceRow[]) {
  const headers = ['Client', 'Package', 'Amount', 'Status', 'Payment method', 'Sent date', 'Paid date']
  const rows = invoices.map((inv) => [
    clientName(inv.clients),
    inv.session_packages?.title ?? '—',
    formatAmount(inv.amount_cents, inv.currency),
    inv.status,
    inv.payment_method ? PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method : '—',
    formatDate(inv.created_at),
    formatDate(inv.paid_at),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function InvoicesPageContent() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [clients, setClients] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([])

  const fetchInvoices = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (clientFilter) params.set('clientId', clientFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load invoices')
        setInvoices([])
        return
      }
      setInvoices(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, clientFilter])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      const json = await res.json()
      if (res.ok) setClients(json.data ?? [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const paid = invoices.filter((i) => i.status === 'paid')
  const pending = invoices.filter((i) => i.status === 'pending')
  const totalReceived = paid.reduce((s, i) => s + i.amount_cents, 0)
  const totalPending = pending.reduce((s, i) => s + i.amount_cents, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-medium text-[var(--color-ink)]">Invoice history</h1>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            View and export all invoices. Filter by status or client.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/coach/packages">
            <Button variant="secondary">Packages</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => exportToCsv(invoices)}
            disabled={invoices.length === 0}
          >
            Export to CSV
          </Button>
        </div>
      </div>

      {!loading && !error && invoices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card variant="raised" padding="lg">
            <p className="text-sm font-medium text-[var(--color-muted)]">Total received</p>
            <p className="mt-1 text-2xl font-medium text-[var(--color-ink)]">
              {formatAmount(totalReceived, 'usd')}
            </p>
          </Card>
          <Card variant="raised" padding="lg">
            <p className="text-sm font-medium text-[var(--color-muted)]">Pending</p>
            <p className="mt-1 text-2xl font-medium text-[var(--color-ink)]">
              {formatAmount(totalPending, 'usd')}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[15px] min-h-[44px]"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[15px] min-h-[44px]"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.id}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="h-6 w-1/3 rounded bg-[var(--color-border)] animate-pulse" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded bg-[var(--color-border)] animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-[var(--color-muted)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchInvoices}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="font-medium text-[var(--color-ink)]">No invoices yet</p>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            Send an invoice from a session package to see it here.
          </p>
          <Link href="/coach/packages">
            <Button className="mt-4">Go to packages</Button>
          </Link>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <Card variant="raised" padding="default" className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-3 pr-4 font-medium text-[var(--color-ink)]">Client</th>
                <th className="pb-3 pr-4 font-medium text-[var(--color-ink)]">Package</th>
                <th className="pb-3 pr-4 font-medium text-[var(--color-ink)]">Amount</th>
                <th className="pb-3 pr-4 font-medium text-[var(--color-ink)]">Status</th>
                <th className="pb-3 pr-4 font-medium text-[var(--color-ink)]">Payment method</th>
                <th className="pb-3 pr-4 font-medium text-[var(--color-ink)]">Sent</th>
                <th className="pb-3 font-medium text-[var(--color-ink)]">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-3 pr-4 text-[var(--color-ink)]">{clientName(inv.clients)}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{inv.session_packages?.title ?? '—'}</td>
                  <td className="py-3 pr-4 text-[var(--color-ink)]">{formatAmount(inv.amount_cents, inv.currency)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.status === 'paid'
                          ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                          : inv.status === 'cancelled' || inv.status === 'refunded'
                            ? 'bg-[var(--color-border)] text-[var(--color-muted)]'
                            : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">
                    {inv.payment_method ? PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method : '—'}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{formatDate(inv.created_at)}</td>
                  <td className="py-3 text-[var(--color-muted)]">{formatDate(inv.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
