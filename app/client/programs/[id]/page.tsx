import Link from 'next/link'
import { ClientProgramDetailContent } from './ClientProgramDetailContent'

export default async function ClientProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/client/programs"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← My Programs
        </Link>
      </div>
      <ClientProgramDetailContent programId={id} />
    </main>
  )
}
