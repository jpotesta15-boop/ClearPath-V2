import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'

const coachSidebarItems = [
  { href: '/coach/dashboard', label: 'Home' },
  { href: '/coach/clients', label: 'Clients' },
  { href: '/coach/schedule', label: 'Schedule' },
  { href: '/coach/programs', label: 'Programs' },
  { href: '/coach/videos', label: 'Videos' },
  { href: '/coach/messages', label: 'Messages' },
  { href: '/coach/packages', label: 'Packages' },
  { href: '/billing', label: 'Billing' },
]

/**
 * Coach layout: require auth + role === 'coach' (11-auth §4.2).
 * Non-coach → /client/dashboard.
 * Desktop (lg+): Nav + Sidebar + content. Mobile: Nav + content + bottom MobileNav.
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
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex lg:w-[240px] lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--color-border)] lg:bg-[var(--color-surface)]">
          <Sidebar items={coachSidebarItems} />
        </aside>
        <div className="flex-1 pb-16 lg:pb-0 min-w-0">
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
