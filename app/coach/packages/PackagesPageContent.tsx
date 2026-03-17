'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { createPackageSchema, createInvoiceSchema, type CreatePackageInput, type CreateInvoiceInput } from '@/lib/validations'

type Package = {
  id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  duration_minutes: number
  session_type: string | null
  is_active: boolean
  created_at: string
}

type Client = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

function PackageCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="h-5 w-2/3 rounded bg-[var(--color-border)]" />
      <div className="mt-2 h-4 w-full rounded bg-[var(--color-border)]" />
      <div className="mt-4 h-6 w-1/3 rounded bg-[var(--color-border)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-10 flex-1 rounded-lg bg-[var(--color-border)]" />
        <div className="h-10 flex-1 rounded-lg bg-[var(--color-border)]" />
      </div>
    </Card>
  )
}

export function PackagesPageContent() {
  const [packages, setPackages] = useState<Package[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editPkg, setEditPkg] = useState<Package | null>(null)
  const [sendInvoicePkg, setSendInvoicePkg] = useState<Package | null>(null)
  const [form, setForm] = useState<CreatePackageInput>({
    title: '',
    description: '',
    price_cents: 0,
    currency: 'usd',
    duration_minutes: 60,
    session_type: '',
    is_active: true,
  })
  const [invoiceForm, setInvoiceForm] = useState<CreateInvoiceInput>({
    packageId: '',
    clientId: '',
    dueDate: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchPackages = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/packages')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load packages')
        setPackages([])
        return
      }
      setPackages(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [])

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
    fetchPackages()
  }, [fetchPackages])

  useEffect(() => {
    if (createOpen || sendInvoicePkg) fetchClients()
  }, [createOpen, sendInvoicePkg, fetchClients])

  const openEdit = (pkg: Package) => {
    setEditPkg(pkg)
    setForm({
      title: pkg.title,
      description: pkg.description ?? '',
      price_cents: pkg.price_cents,
      currency: pkg.currency,
      duration_minutes: pkg.duration_minutes,
      session_type: pkg.session_type ?? '',
      is_active: pkg.is_active,
    })
  }

  const openSendInvoice = (pkg: Package) => {
    setSendInvoicePkg(pkg)
    setInvoiceForm({
      packageId: pkg.id,
      clientId: '',
      dueDate: '',
    })
    setSubmitError(null)
  }

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const parsed = createPackageSchema.safeParse({
      ...form,
      description: form.description || null,
      session_type: form.session_type || null,
    })
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setSubmitting(true)
    try {
      const url = editPkg ? `/api/packages/${editPkg.id}` : '/api/packages'
      const method = editPkg ? 'PATCH' : 'POST'
      const body = editPkg
        ? {
            title: parsed.data.title,
            description: parsed.data.description,
            price_cents: parsed.data.price_cents,
            currency: parsed.data.currency,
            duration_minutes: parsed.data.duration_minutes,
            session_type: parsed.data.session_type,
            is_active: parsed.data.is_active,
          }
        : parsed.data
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not save package')
        return
      }
      setCreateOpen(false)
      setEditPkg(null)
      setForm({ title: '', description: '', price_cents: 0, currency: 'usd', duration_minutes: 60, session_type: '', is_active: true })
      fetchPackages()
    } catch {
      setSubmitError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sendInvoicePkg) return
    setSubmitError(null)
    const parsed = createInvoiceSchema.safeParse({
      packageId: sendInvoicePkg.id,
      clientId: invoiceForm.clientId || undefined,
      dueDate: invoiceForm.dueDate || null,
    })
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Select a client')
      return
    }
    if (!parsed.data.clientId) {
      setSubmitError('Please select a client')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not send invoice')
        return
      }
      setSendInvoicePkg(null)
      setInvoiceForm({ packageId: '', clientId: '', dueDate: '' })
      fetchPackages()
      window.location.href = '/coach/messages'
    } catch {
      setSubmitError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-medium text-[var(--color-ink)]">Session packages</h1>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            Create packages and send invoices to clients from here or in messages.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/coach/invoices">
            <Button variant="secondary">Invoice history</Button>
          </Link>
          <Button onClick={() => { setCreateOpen(true); setEditPkg(null); setForm({ title: '', description: '', price_cents: 0, currency: 'usd', duration_minutes: 60, session_type: '', is_active: true }); setSubmitError(null); }}>
            Create package
          </Button>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-[var(--color-muted)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchPackages}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && packages.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="font-medium text-[var(--color-ink)]">No packages yet</p>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            Create a session package to send invoices to clients.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            Create package
          </Button>
        </div>
      )}

      {!loading && !error && packages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.filter((p) => p.is_active).map((pkg) => (
            <Card key={pkg.id} variant="raised" padding="lg">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-[var(--color-ink)]">{pkg.title}</h3>
              </div>
              {pkg.description && (
                <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">{pkg.description}</p>
              )}
              <p className="mt-4 text-lg font-medium text-[var(--color-ink)]">
                {formatAmount(pkg.price_cents, pkg.currency)}
              </p>
              {pkg.duration_minutes > 0 && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {pkg.duration_minutes} min
                  {pkg.session_type ? ` · ${pkg.session_type}` : ''}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => openSendInvoice(pkg)}
                >
                  Send invoice
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={() => openEdit(pkg)}
                >
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={createOpen || !!editPkg}
        onClose={() => { setCreateOpen(false); setEditPkg(null); setSubmitError(null); }}
        title={editPkg ? 'Edit package' : 'Create package'}
        className="max-w-md"
      >
        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Single session"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Description</label>
            <Textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
              rows={2}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Price (USD) *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price_cents ? (form.price_cents / 100).toFixed(2) : ''}
              onChange={(e) => setForm((f) => ({ ...f, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Duration (minutes)</label>
            <Input
              type="number"
              min="5"
              max="480"
              value={form.duration_minutes || ''}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value || '60', 10) }))}
              placeholder="60"
            />
          </div>
          {submitError && <p className="text-sm text-[var(--color-error)]">{submitError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => { setCreateOpen(false); setEditPkg(null); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : editPkg ? 'Save changes' : 'Create package'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!sendInvoicePkg}
        onClose={() => { setSendInvoicePkg(null); setSubmitError(null); }}
        title="Send invoice"
        className="max-w-md"
      >
        {sendInvoicePkg && (
          <form onSubmit={handleSendInvoice} className="space-y-4">
            <p className="text-sm text-[var(--color-muted)]">
              Sending invoice for <strong>{sendInvoicePkg.title}</strong> ({formatAmount(sendInvoicePkg.price_cents, sendInvoicePkg.currency)})
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Client *</label>
              <select
                value={invoiceForm.clientId}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[15px] min-h-[44px]"
                required
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Due date</label>
              <Input
                type="date"
                value={invoiceForm.dueDate ?? ''}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value || undefined }))}
              />
            </div>
            {submitError && <p className="text-sm text-[var(--color-error)]">{submitError}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={() => setSendInvoicePkg(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send invoice'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
