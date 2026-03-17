import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { Card } from '@/components/ui/Card'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

type PackageRow = { id: string; title: string | null; description: string | null }
type InvoiceRow = {
  id: string
  amount_cents: number
  currency: string
  status: string
  due_date: string | null
  paid_at: string | null
  created_at: string
  session_packages: PackageRow | null
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

export default async function ClientInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">Please log in to view your invoices.</p>
      </main>
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!client) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">We couldn&apos;t find your client record.</p>
      </main>
    )
  }

  const { data: invoices } = await supabase
    .from('session_invoices')
    .select(`
      id, amount_cents, currency, status, due_date, paid_at, created_at,
      session_packages(id, title, description)
    `)
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  const list = (invoices ?? []) as unknown as InvoiceRow[]

  return (
    <main className="min-h-screen p-6">
      <div className="mb-4">
        <Link
          href="/client/portal"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Back to portal
        </Link>
      </div>
      <h1 className="text-xl font-medium text-[var(--color-ink)]">My invoices</h1>
      <p className="mt-1 text-[15px] text-[var(--color-muted)]">
        View your session invoices and payment status.
      </p>

      {list.length === 0 ? (
        <Card variant="raised" padding="lg" className="mt-6 text-center">
          <p className="font-medium text-[var(--color-ink)]">No invoices yet</p>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            When your coach sends you an invoice, it will appear here and in Messages.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map((inv) => (
            <li key={inv.id}>
              <Card variant="raised" padding="lg">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium text-[var(--color-ink)]">
                      {inv.session_packages?.title ?? 'Invoice'}
                    </h2>
                    <p className="mt-1 text-[15px] text-[var(--color-muted)]">
                      {formatAmount(inv.amount_cents, inv.currency)}
                    </p>
                    {inv.due_date && inv.status === 'pending' && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Due {format(new Date(inv.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    {inv.paid_at && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Paid {format(new Date(inv.paid_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
                      inv.status === 'paid'
                        ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                        : inv.status === 'cancelled' || inv.status === 'refunded'
                          ? 'bg-[var(--color-border)]/80 text-[var(--color-muted)]'
                          : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
                    }`}
                  >
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
