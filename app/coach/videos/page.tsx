import Link from 'next/link'
import { VideosPageContent } from './VideosPageContent'

export default function CoachVideosPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/coach/dashboard"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Dashboard
        </Link>
      </div>
      <VideosPageContent />
    </main>
  )
}
