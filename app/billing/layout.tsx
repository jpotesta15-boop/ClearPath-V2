import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { MobileNav, coachTabs } from '@/components/layout/MobileNav'

/**
 * Billing layout: coach-only; same nav as coach area (Nav + MobileNav with Billing).
 */
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'coach') {
    redirect(profile?.role === 'client' ? '/client/portal' : '/coach/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface)]">
      <Nav />
      <div className="flex-1 pb-16 lg:pb-0">
        {children}
      </div>
      <MobileNav tabs={coachTabs} />
    </div>
  )
}
