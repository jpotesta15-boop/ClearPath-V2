'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

type VideoDetail = {
  id: string
  title: string
  processing_status: string
  playback_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
}

type ContentBlock = {
  id: string
  module_id: string
  content_type: 'text' | 'url' | 'video' | 'file'
  title: string | null
  body: string | null
  url: string | null
  video_id: string | null
  file_url: string | null
  position: number
}

type Module = {
  id: string
  program_id: string
  title: string
  description: string | null
  position: number
  content: ContentBlock[]
  completed: boolean
}

type ProgramDetail = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string
  total_modules: number
  clientProgramId: string
  modules: Module[]
  progress: { modulesCompleted: number; totalModules: number }
}

export function ClientProgramDetailContent({ programId }: { programId: string }) {
  const [data, setData] = useState<ProgramDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const [completingModuleId, setCompletingModuleId] = useState<string | null>(null)
  const [showCompletionBanner, setShowCompletionBanner] = useState(false)

  const fetchProgram = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/client/programs/${programId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load program')
        setData(null)
        return
      }
      setData(json.data)
      const firstIncomplete = json.data?.modules?.find((m: Module) => !m.completed)
      if (firstIncomplete && !expandedModuleId) {
        setExpandedModuleId(firstIncomplete.id)
      }
    } catch {
      setError('Something went wrong — check your connection and try again')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchProgram()
  }, [fetchProgram])

  const handleMarkComplete = async (moduleId: string) => {
    setCompletingModuleId(moduleId)
    try {
      const res = await fetch(`/api/progress/${moduleId}/complete`, { method: 'POST' })
      if (res.ok) {
        const updated = await fetch(`/api/client/programs/${programId}`).then((r) => r.json())
        if (updated?.data) {
          setData(updated.data)
          const prog = updated.data.progress
          if (
            prog?.totalModules > 0 &&
            prog.modulesCompleted >= prog.totalModules
          ) {
            setShowCompletionBanner(true)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setCompletingModuleId(null)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-2/3 rounded bg-[var(--color-border)]" />
        <div className="h-4 w-full rounded bg-[var(--color-border)]" />
        <div className="h-2 w-full rounded bg-[var(--color-border)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-[var(--color-muted)]">{error ?? 'Program not found'}</p>
        <Link href="/client/programs">
          <Button variant="secondary" className="mt-4">
            Back to programs
          </Button>
        </Link>
      </div>
    )
  }

  const pct =
    data.progress.totalModules > 0
      ? Math.round((data.progress.modulesCompleted / data.progress.totalModules) * 100)
      : 0
  const allComplete = data.progress.modulesCompleted >= data.progress.totalModules && data.progress.totalModules > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium text-[var(--color-ink)]">{data.title}</h1>
        {data.description && (
          <p className="mt-2 text-[15px] text-[var(--color-muted)]">{data.description}</p>
        )}
      </div>

      <div>
        <div className="flex justify-between text-sm text-[var(--color-muted)] mb-1">
          <span>Progress</span>
          <span>
            {data.progress.modulesCompleted} of {data.progress.totalModules} modules
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {showCompletionBanner && allComplete && (
        <Card variant="raised" padding="lg" className="border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
          <p className="font-medium text-[var(--color-ink)] text-center">
            Program complete! Great work.
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)] text-center" aria-hidden>
            🎉
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {(data.modules ?? []).map((mod) => {
          const isExpanded = expandedModuleId === mod.id
          return (
            <Card key={mod.id} variant="raised" padding="lg">
              <button
                type="button"
                className="w-full flex items-center gap-3 text-left"
                onClick={() => setExpandedModuleId(isExpanded ? null : mod.id)}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    mod.completed
                      ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                      : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  )}
                  aria-hidden
                >
                  {mod.completed ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="text-xs font-medium">
                      {data.modules?.findIndex((m) => m.id === mod.id)! + 1}
                    </span>
                  )}
                </span>
                <span className="flex-1 font-medium text-[var(--color-ink)]">{mod.title}</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={cn('shrink-0 transition-transform', isExpanded && 'rotate-180')}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  {mod.description && (
                    <p className="text-sm text-[var(--color-muted)] mb-4">{mod.description}</p>
                  )}
                  <div className="space-y-4">
                    {(mod.content ?? []).map((block) => (
                      <ContentBlockDisplay key={block.id} block={block} />
                    ))}
                  </div>
                  {!mod.completed && (
                    <Button
                      className="mt-4 w-full min-h-[44px]"
                      onClick={() => handleMarkComplete(mod.id)}
                      disabled={!!completingModuleId}
                    >
                      {completingModuleId === mod.id ? 'Marking…' : 'Mark complete'}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function ClientVideoBlock({ block }: { block: ContentBlock }) {
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(!!block.video_id)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!block.video_id) {
      setLoading(false)
      return
    }
    let mounted = true
    fetch(`/api/videos/${block.video_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        if (data.data) setVideo(data.data)
        else setError(true)
      })
      .catch(() => mounted && setError(true))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [block.video_id])

  if (!block.video_id) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
        <p className="text-sm text-[var(--color-muted)]">No video selected</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">Loading video…</p>
      </div>
    )
  }
  if (error || !video) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
        <p className="text-sm text-[var(--color-muted)]">Video unavailable</p>
      </div>
    )
  }
  if (video.processing_status === 'processing' || video.processing_status === 'queued') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm text-amber-800">Video is being processed. Check back soon.</p>
      </div>
    )
  }
  if (video.processing_status === 'ready' && video.playback_url) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        {block.title && (
          <p className="px-3 py-2 text-sm font-medium text-[var(--color-ink)] bg-[var(--color-surface)]">
            {block.title}
          </p>
        )}
        <video
          src={video.playback_url}
          controls
          className="w-full"
          playsInline
        />
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
      <p className="text-sm text-[var(--color-muted)]">Video unavailable</p>
    </div>
  )
}

function ContentBlockDisplay({ block }: { block: ContentBlock }) {
  if (block.content_type === 'text') {
    return (
      <div className="prose prose-sm max-w-none">
        {block.title && <h4 className="font-medium text-[var(--color-ink)]">{block.title}</h4>}
        <div className="text-[15px] text-[var(--color-ink)] whitespace-pre-wrap">
          {block.body || ''}
        </div>
      </div>
    )
  }
  if (block.content_type === 'url') {
    return (
      <a
        href={block.url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface)]"
      >
        <span className="text-[var(--color-accent)]" aria-hidden>
          🔗
        </span>
        <span className="font-medium text-[var(--color-ink)]">
          {block.title || block.url || 'Link'}
        </span>
      </a>
    )
  }
  if (block.content_type === 'video') {
    return <ClientVideoBlock block={block} />
  }
  if (block.content_type === 'file' && block.file_url) {
    return (
      <a
        href={block.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface)]"
      >
        <span aria-hidden>📎</span>
        {block.title || 'Download file'}
      </a>
    )
  }
  return null
}
