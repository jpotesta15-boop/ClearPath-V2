import { Card } from '@/components/ui/Card'

export default function PortalLoading() {
  return (
    <main className="min-h-screen p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-[var(--color-border)] mb-6" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} variant="raised" padding="lg" className="min-h-[120px] animate-pulse" />
        ))}
      </div>
    </main>
  )
}
