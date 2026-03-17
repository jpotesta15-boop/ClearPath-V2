import { ClientDetailContent } from './ClientDetailContent'

type Props = { params: Promise<{ id: string }> }

export default async function CoachClientDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <main className="min-h-screen p-6">
      <ClientDetailContent clientId={id} />
    </main>
  )
}
