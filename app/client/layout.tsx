import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { ClientLayoutWithUnread } from '@/components/layout/ClientLayoutWithUnread'

/**
 * Client layout: require auth + role !== 'coach' (11-auth §4.2).
 * Uses MobileNav (bottom tab bar) with unread message badge and top Nav.
 */
export default async function ClientLayout({
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
  if (profile?.role === 'coach') {
    redirect('/coach/dashboard')
  }

  let clientDisplayName: string | null = null
  if (user.email) {
    const { data: client } = await supabase
      .from('clients')
      .select('first_name, last_name')
      .eq('email', user.email)
      .maybeSingle()
    if (client) {
      clientDisplayName = [client.first_name, client.last_name].filter(Boolean).join(' ') || null
    }
  }

  return (
    <ClientLayoutWithUnread userDisplayName={clientDisplayName}>
      {children}
    </ClientLayoutWithUnread>
  )
}
