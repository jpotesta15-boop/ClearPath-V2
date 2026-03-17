'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/layout/PageHeader'
import { createProgramSchema } from '@/lib/validations'
import { AssignProgramModal } from '@/components/coach/AssignProgramModal'
import { cn } from '@/lib/utils'

type Program = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string
  total_modules: number
  created_at: string
  updated_at: string
  assigned_count?: number
}

type Tab = 'all' | 'draft' | 'published' | 'archived'

function ProgramCardSkeleton() {
  return (
    <Card variant="raised" padding="lg" className="animate-pulse">
      <div className="aspect-video rounded-lg bg-[var(--color-border)]" />
      <div className="mt-4 h-5 w-2/3 rounded bg-[var(--color-border)]" />
      <div className="mt-2 h-4 w-full rounded bg-[var(--color-border)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-16 rounded-full bg-[var(--color-border)]" />
        <div className="mt-4 h-10 flex-1 rounded-lg bg-[var(--color-border)]" />
      </div>
    </Card>
  )
}

export function ProgramsPageContent() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [assignProgramId, setAssignProgramId] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchPrograms = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (tab !== 'all') params.set('status', tab)
      const res = await fetch(`/api/programs?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load programs')
        setPrograms([])
        return
      }
      setPrograms(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setPrograms([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    setLoading(true)
    fetchPrograms()
  }, [fetchPrograms])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const parsed = createProgramSchema.safeParse({
      title: createTitle.trim(),
      description: createDescription.trim() || null,
    })
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not create program')
        return
      }
      setCreateOpen(false)
      setCreateTitle('')
      setCreateDescription('')
      router.push(`/coach/programs/${json.data.id}`)
    } catch {
      setSubmitError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ]

  return (
    <div>
      <PageHeader title="Programs">
        <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
          Create program
        </Button>
      </PageHeader>

      <div className="mt-6 flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'min-h-[44px] px-4 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.value
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <ProgramCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-[var(--color-muted)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchPrograms}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && programs.length === 0 && (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="font-medium text-[var(--color-ink)]">No programs yet</p>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            Create your first program to start delivering structured content to your clients.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            Create program
          </Button>
        </div>
      )}

      {!loading && !error && programs.length > 0 && (
        <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
          {programs.map((prog) => (
            <Card key={prog.id} variant="raised" padding="lg">
              <div className="aspect-video rounded-lg bg-[var(--color-border)] overflow-hidden">
                {prog.thumbnail_url ? (
                  <img
                    src={prog.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[var(--color-muted)] text-sm">
                    No image
                  </div>
                )}
              </div>
              <h3 className="mt-4 font-medium text-[var(--color-ink)]">{prog.title}</h3>
              <span
                className={cn(
                  'mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                  prog.status === 'published' && 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
                  prog.status === 'draft' && 'bg-[var(--color-muted)]/20 text-[var(--color-muted)]',
                  prog.status === 'archived' && 'bg-[var(--color-border)] text-[var(--color-muted)]'
                )}
              >
                {prog.status.charAt(0).toUpperCase() + prog.status.slice(1)}
              </span>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {prog.total_modules} module{prog.total_modules !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                Assigned to {prog.assigned_count ?? 0} client{(prog.assigned_count ?? 0) !== 1 ? 's' : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/coach/programs/${prog.id}`}>
                  <Button variant="secondary" className="min-h-[44px]">
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={() => setAssignProgramId(prog.id)}
                >
                  Assign
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setSubmitError(null)
        }}
        title="Create program"
        className="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">
              Title *
            </label>
            <Input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="e.g. Getting Started"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">
              Description
            </label>
            <Textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>
          {submitError && (
            <p className="text-sm text-[var(--color-error)]">{submitError}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create program'}
            </Button>
          </div>
        </form>
      </Modal>

      <AssignProgramModal
        programId={assignProgramId ?? ''}
        open={!!assignProgramId}
        onClose={() => setAssignProgramId(null)}
        onAssigned={() => {
          setAssignProgramId(null)
          fetchPrograms()
        }}
      />
    </div>
  )
}
