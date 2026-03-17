import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { MobileNav, coachTabs } from '@/components/layout/MobileNav'

/**
 * Coach layout: require auth + role === 'coach' (11-auth §4.2).
 * Non-coach → /client/dashboard.
 * Renders Nav + MobileNav (Packages, Billing, etc.) like billing layout.
 */
export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'coach') {
    redirect('/client/portal')
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
