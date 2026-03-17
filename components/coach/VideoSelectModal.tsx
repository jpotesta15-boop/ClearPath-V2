'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export type VideoOption = {
  id: string
  title: string
  thumbnail_url: string | null
  duration_seconds: number | null
  playback_url: string | null
  processing_status: string
}

export interface VideoSelectModalProps {
  open: boolean
  onClose: () => void
  onSelect: (video: VideoOption) => void
}

export function VideoSelectModal({ open, onClose, onSelect }: VideoSelectModalProps) {
  const [videos, setVideos] = useState<VideoOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setLoading(true)
    fetch('/api/videos?status=ready')
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setVideos(data.data)
        else setVideos([])
        if (data.error) setError(data.error)
      })
      .catch(() => setError('Could not load videos'))
      .finally(() => setLoading(false))
  }, [open])

  return (
    <Modal isOpen={open} onClose={onClose} title="Select video" className="max-w-2xl">
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-video rounded-lg bg-[var(--color-border)] animate-pulse" aria-hidden />
          ))}
        </div>
      )}
      {error && !loading && (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      )}
      {!loading && !error && videos.length === 0 && (
        <p className="text-[var(--color-muted)]">No ready videos. Import videos from the Video library first.</p>
      )}
      {!loading && !error && videos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-auto">
          {videos.map((video) => (
            <button
              key={video.id}
              type="button"
              onClick={() => {
                onSelect(video)
                onClose()
              }}
              className="rounded-lg border border-[var(--color-border)] overflow-hidden text-left hover:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
            >
              <div className="aspect-video bg-[var(--color-border)]">
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 8l6 4-6 4V8z" />
                      <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium text-[var(--color-ink)] line-clamp-2">{video.title}</p>
                {video.duration_seconds != null && (
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatDuration(video.duration_seconds)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
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
