import Link from 'next/link'
import { ClientProgramsContent } from './ClientProgramsContent'

export default function ClientProgramsPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/client/portal"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Home
        </Link>
      </div>
      <ClientProgramsContent />
    </main>
  )
}
