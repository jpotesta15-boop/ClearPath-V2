import { Card } from '@/components/ui/Card'

export default function BillingLoading() {
  return (
    <main className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <div className="h-7 w-24 rounded-lg bg-[var(--color-border)] animate-pulse" />
      </div>
      <Card variant="raised" padding="lg">
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-full bg-[var(--color-border)] animate-pulse" />
          <div className="h-6 w-14 rounded-full bg-[var(--color-border)] animate-pulse" />
        </div>
        <div className="mt-2 h-5 w-48 rounded bg-[var(--color-border)] animate-pulse" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} variant="raised" padding="lg">
            <div className="h-5 w-16 rounded bg-[var(--color-border)] animate-pulse" />
            <div className="mt-2 h-8 w-20 rounded bg-[var(--color-border)] animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-4 w-full rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-[var(--color-border)] animate-pulse" />
            </div>
            <div className="mt-4 h-10 w-full rounded-lg bg-[var(--color-border)] animate-pulse" />
          </Card>
        ))}
      </div>
      <Card variant="flat" padding="default">
        <div className="h-10 w-36 rounded-lg bg-[var(--color-border)] animate-pulse" />
        <div className="mt-2 h-4 w-64 rounded bg-[var(--color-border)] animate-pulse" />
      </Card>
    </main>
  )
}
