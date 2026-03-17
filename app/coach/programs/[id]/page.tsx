import Link from 'next/link'
import { ProgramEditorContent } from './ProgramEditorContent'

export default async function CoachProgramEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/coach/programs"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Programs
        </Link>
      </div>
      <ProgramEditorContent programId={id} />
    </main>
  )
}
