import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { ClientPortalProgramCard } from './ClientPortalProgramCard'
import { format, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function ClientPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    redirect('/login')
  }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, first_name, status')
    .eq('email', user.email)
    .maybeSingle()

  if (error || !client) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">
          We couldn&apos;t find your client record. Contact your coach to get set up.
        </p>
      </main>
    )
  }

  if (client.status === 'paused' || client.status === 'completed') {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <Card variant="raised" padding="lg" className="max-w-md text-center">
          <p className="text-[15px] text-[var(--color-text-primary)]">
            Your account is currently paused. Contact your coach for more information.
          </p>
        </Card>
      </main>
    )
  }

  const firstName = client.first_name?.trim() || 'there'
  const now = new Date().toISOString()
  const { data: nextSession } = await supabase
    .from('sessions')
    .select('id, scheduled_time, end_time, duration_minutes, status')
    .eq('client_id', client.id)
    .gte('scheduled_time', now)
    .in('status', ['pending', 'confirmed'])
    .order('scheduled_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { count: pendingInvoicesCount } = await supabase
    .from('session_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('status', 'pending')

  const sections = [
    { title: 'Messages', placeholder: 'No messages yet', icon: '💬' },
    { title: 'My Progress', placeholder: 'Nothing tracked yet', icon: '📈' },
  ] as const

  return (
    <main className="min-h-screen p-6">
      <PageHeader title={`Welcome back, ${firstName}`} />
      {pendingInvoicesCount != null && pendingInvoicesCount > 0 && (
        <Card variant="raised" padding="lg" className="mt-6 border-[var(--color-warning)]/30 bg-[var(--color-warning-light)]/30">
          <p className="text-[15px] text-[var(--color-ink)]">
            You have {pendingInvoicesCount} pending invoice{pendingInvoicesCount !== 1 ? 's' : ''}.
          </p>
          <Link
            href="/client/invoices"
            className="mt-2 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            View invoices
          </Link>
        </Card>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ClientPortalProgramCard />
        <Card variant="raised" padding="lg">
          <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
            Upcoming Sessions
          </h2>
          {nextSession ? (
            <>
              <p className="text-[14px] text-[var(--color-text-primary)]">
                {format(parseISO(nextSession.scheduled_time), 'EEEE, MMM d')} at{' '}
                {format(parseISO(nextSession.scheduled_time), 'h:mm a')}
              </p>
              <Link
                href="/client/sessions"
                className="mt-2 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                View all sessions
              </Link>
            </>
          ) : (
            <>
              <p className="text-[14px] text-[var(--color-muted)] flex items-center gap-2">
                <span aria-hidden>📅</span>
                No sessions scheduled
              </p>
              <Link
                href="/client/sessions"
                className="mt-2 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                View all sessions
              </Link>
            </>
          )}
        </Card>
        {sections.map(({ title, placeholder, icon }) => (
          <Card key={title} variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
              {title}
            </h2>
            <p className="text-[14px] text-[var(--color-muted)] flex items-center gap-2">
              <span aria-hidden>{icon}</span>
              {placeholder}
            </p>
          </Card>
        ))}
      </div>
    </main>
  )
}
