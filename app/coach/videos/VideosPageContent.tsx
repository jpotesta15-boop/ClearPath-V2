'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { Video } from './types'

export function VideosPageContent() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [playerVideo, setPlayerVideo] = useState<Video | null>(null)
  const [addToProgramVideo, setAddToProgramVideo] = useState<Video | null>(null)
  const [folderId, setFolderId] = useState('')
  const [folderIdSaving, setFolderIdSaving] = useState(false)
  const [folderIdSaved, setFolderIdSaved] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const router = useRouter()

  const fetchVideos = useCallback(async () => {
    const res = await fetch('/api/videos')
    const data = await res.json()
    if (res.ok) setVideos(data.data ?? [])
    else setError(data.error ?? 'Could not load videos')
  }, [])

  const fetchFolderId = useCallback(async () => {
    const res = await fetch('/api/workspaces/import-folder')
    const data = await res.json()
    if (res.ok && data.folderId != null) setFolderId(data.folderId ?? '')
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([fetchVideos(), fetchFolderId()]).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [fetchVideos, fetchFolderId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('videos-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'videos' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const title = row?.title as string
          setVideos((prev) => [row as Video, ...prev])
          if (title) setToast(`Video added: ${title}`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const id = row?.id as string
          const status = row?.processing_status as string
          const title = row?.title as string
          setVideos((prev) => {
            const idx = prev.findIndex((v) => v.id === id)
            if (idx === -1) return prev
            const next = [...prev]
            next[idx] = { ...next[idx], ...row } as Video
            return next
          })
          if (status === 'ready' && title) setToast(`Video ready: ${title}`)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const saveFolderId = async () => {
    setFolderIdSaving(true)
    setFolderIdSaved(false)
    try {
      const res = await fetch('/api/workspaces/import-folder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderId.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setToast('Import folder saved')
        setFolderIdSaved(true)
        fetchFolderId() // refetch so input shows what's stored
        setTimeout(() => setFolderIdSaved(false), 3000)
      } else {
        setToast(data?.error ?? 'Could not save — try again')
      }
    } catch {
      setToast('Could not save — try again')
    } finally {
      setFolderIdSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[var(--color-muted)]">Loading your videos...</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-medium text-[var(--color-ink)]">Video library</h1>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface)] min-h-[44px]"
            aria-label="How do I add videos from my phone?"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            How do I add videos from my phone?
          </button>
        </div>

        <Card padding="default" className="max-w-xl">
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Google Drive import folder ID
          </label>
          <p className="text-xs text-[var(--color-muted)] mb-2">
            Create a folder in Google Drive, open it, and copy the ID from the URL (e.g. <code className="bg-[var(--color-border)] px-1 rounded">drive.google.com/drive/folders/THIS_IS_THE_ID</code>).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="Paste folder ID"
              className="flex-1 min-w-0"
            />
            <Button onClick={saveFolderId} disabled={folderIdSaving}>
              {folderIdSaving ? 'Saving…' : 'Save'}
            </Button>
            {folderIdSaved && (
              <span className="text-sm font-medium text-[var(--color-success)]">Saved</span>
            )}
          </div>
          {folderId.trim() && (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Import folder set. Upload videos to that folder and they&apos;ll appear here after processing.
            </p>
          )}
        </Card>

        {error && (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        )}

        {!error && videos.length === 0 && (
          <Card padding="lg" className="text-center max-w-md mx-auto">
            <p className="font-medium text-[var(--color-ink)] mb-1">No videos yet</p>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Set your import folder above, then upload videos to that folder from your phone or computer. They&apos;ll appear here in a few minutes.
            </p>
            <Button variant="secondary" onClick={() => setInfoOpen(true)}>
              How do I add videos from my phone?
            </Button>
          </Card>
        )}

        {!error && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onPlay={() => setPlayerVideo(video)}
                onRetry={undefined}
                onDelete={async () => {
                  if (!confirm(`Delete "${video.title}"?`)) return
                  const res = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' })
                  if (res.ok) fetchVideos()
                }}
                onAddToProgram={() => setAddToProgramVideo(video)}
              />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-lg bg-[var(--color-ink)] text-white px-4 py-3 text-sm shadow-lg lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm">
          {toast}
        </div>
      )}

      {infoOpen && (
        <Modal
          isOpen
          onClose={() => setInfoOpen(false)}
          title="How to add videos from your phone"
          className="max-w-md"
        >
          <ol className="list-decimal list-inside space-y-3 text-sm text-[var(--color-ink)]">
            <li>Create a folder in Google Drive (or use an existing one).</li>
            <li>Open the folder and copy the folder ID from the URL (the long string after <code className="bg-[var(--color-border)] px-1 rounded">/folders/</code>). Paste it in the &quot;Google Drive import folder ID&quot; field on this page and click Save.</li>
            <li>Upload videos to that folder from your phone or computer. New videos are converted to MP4 and appear here in a few minutes.</li>
          </ol>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => setInfoOpen(false)}>Close</Button>
          </div>
        </Modal>
      )}

      {playerVideo?.playback_url && (
        <Modal
          isOpen={!!playerVideo}
          onClose={() => setPlayerVideo(null)}
          title={playerVideo.title}
          className="max-w-3xl"
        >
          <video
            src={playerVideo.playback_url}
            controls
            className="w-full rounded-lg"
            playsInline
          />
          <div className="mt-3 flex gap-4 text-sm text-[var(--color-muted)]">
            {playerVideo.duration_seconds != null && (
              <span>Duration: {formatDuration(playerVideo.duration_seconds)}</span>
            )}
            {playerVideo.file_size_bytes != null && (
              <span>Size: {formatFileSize(playerVideo.file_size_bytes)}</span>
            )}
          </div>
        </Modal>
      )}

      {addToProgramVideo && (
        <AddToProgramModal
          videoTitle={addToProgramVideo.title}
          onClose={() => setAddToProgramVideo(null)}
          onSelectProgram={(programId) => {
            setAddToProgramVideo(null)
            router.push(`/coach/programs/${programId}`)
          }}
        />
      )}
    </>
  )
}

function AddToProgramModal({
  videoTitle,
  onClose,
  onSelectProgram,
}: {
  videoTitle: string
  onClose: () => void
  onSelectProgram: (programId: string) => void
}) {
  const [programs, setPrograms] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/programs')
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setPrograms(data.data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add to program"
      className="max-w-md"
    >
      <p className="text-sm text-[var(--color-muted)] mb-3">
        Add &quot;{videoTitle}&quot; to a program. You can add a video block and select this video in the program editor.
      </p>
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading programs…</p>
      ) : programs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No programs yet. Create one first.</p>
      ) : (
        <ul className="space-y-1 max-h-60 overflow-auto">
          {programs.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectProgram(p.id)}
                className="w-full text-left rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`
  return `${bytes} B`
}

function VideoCard({
  video,
  onPlay,
  onRetry,
  onDelete,
  onAddToProgram,
}: {
  video: Video
  onPlay: () => void
  onRetry: undefined | (() => void)
  onDelete: () => void
  onAddToProgram: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isReady = video.processing_status === 'ready'
  const isFailed = video.processing_status === 'failed'
  const isProcessing = video.processing_status === 'processing' || video.processing_status === 'queued'

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-video bg-[var(--color-border)]">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <svg className="w-12 h-12 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
          </div>
        )}
        {isReady && (
          <button
            type="button"
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center bg-[var(--color-ink)]/30 opacity-0 hover:opacity-100 transition-opacity rounded-t-lg"
            aria-label={`Play ${video.title}`}
          >
            <span className="rounded-full bg-white/90 p-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
        <div className="absolute top-2 right-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-[var(--color-muted)] hover:bg-white/20 hover:text-white"
              aria-label="Options"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
                    onClick={() => { onAddToProgram(); setMenuOpen(false) }}
                  >
                    Add to program
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-error-light)]"
                    onClick={() => { onDelete(); setMenuOpen(false) }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-[var(--color-ink)] line-clamp-2">{video.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
          {isReady && video.duration_seconds != null && (
            <span>{formatDuration(video.duration_seconds)}</span>
          )}
          {isReady && video.file_size_bytes != null && (
            <span>{formatFileSize(video.file_size_bytes)}</span>
          )}
        </div>
        {isProcessing && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 animate-pulse">
            Processing
          </span>
        )}
        {video.processing_status === 'queued' && (
          <span className="mt-2 inline-block rounded-full bg-[var(--color-muted)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]">
            Queued
          </span>
        )}
        {isFailed && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--color-error)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-error)]">
              Failed
            </span>
            {onRetry && (
              <Button variant="secondary" className="min-h-[32px] text-xs" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
