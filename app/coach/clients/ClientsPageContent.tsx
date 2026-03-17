'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { AddClientModal } from './AddClientModal'
import { formatDistanceToNow } from 'date-fns'

type Client = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  goals: string | null
  status: string
  notes: string | null
  profile_photo_url: string | null
  created_at: string
  updated_at: string
}

type StatusFilter = '' | 'active' | 'paused' | 'completed'

function getInitials(first: string | null, last: string | null, email: string | null): string {
  if (first?.trim() || last?.trim()) {
    const a = (first?.trim() ?? '').slice(0, 1).toUpperCase()
    const b = (last?.trim() ?? '').slice(0, 1).toUpperCase()
    if (a || b) return `${a}${b}`
  }
  if (email?.trim()) return (email.trim().slice(0, 2)).toUpperCase()
  return '?'
}

function statusBadgeVariant(status: string): 'active' | 'inactive' | 'pending' {
  if (status === 'active') return 'active'
  if (status === 'paused') return 'pending'
  return 'inactive'
}

export function CoachClientsPageContent() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/clients?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load clients')
        setClients([])
        return
      }
      setClients(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  const handleAddSuccess = () => {
    setAddModalOpen(false)
    setToast('Client added')
    fetchClients()
    setTimeout(() => setToast(null), 4000)
  }

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ]

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Manage your roster"
      >
        <Button onClick={() => setAddModalOpen(true)}>
          Add client
        </Button>
      </PageHeader>

      <div className="mt-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search clients"
              className="max-w-md"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {tabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-[15px] font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <ClientListSkeleton />}
        {!loading && error && (
          <Card className="rounded-xl border border-[var(--color-border)] p-6 text-center">
            <p className="text-[var(--color-text-primary)]">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => fetchClients()}>
              Try again
            </Button>
          </Card>
        )}
        {!loading && !error && clients.length === 0 && (
          <Card className="rounded-xl border border-[var(--color-border)] p-8 text-center">
            <h2 className="text-[18px] font-medium text-[var(--color-text-primary)]">
              No clients yet
            </h2>
            <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
              Add your first client to start managing your roster.
            </p>
            <Button className="mt-6" onClick={() => setAddModalOpen(true)}>
              Add your first client
            </Button>
          </Card>
        )}
        {!loading && !error && clients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/coach/clients/${client.id}`}
                className="block min-w-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 rounded-xl"
              >
                <Card variant="raised" padding="lg" className="h-full transition-shadow hover:shadow-[var(--shadow-card-raised)]">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-[15px] font-medium text-[var(--color-accent)]"
                      aria-hidden
                    >
                      {getInitials(client.first_name, client.last_name, client.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--color-text-primary)]">
                        {[client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'}
                      </p>
                      {client.email && (
                        <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
                          {client.email}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={statusBadgeVariant(client.status)}>
                          {client.status}
                        </Badge>
                        <span className="text-[13px] text-[var(--color-text-secondary)]">
                          {client.updated_at
                            ? `Active ${formatDistanceToNow(new Date(client.updated_at), { addSuffix: true })}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AddClientModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-text-primary)] px-4 py-3 text-[15px] font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function ClientListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} variant="raised" padding="lg" className="h-full">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--color-border)] animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-[var(--color-border)] animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
