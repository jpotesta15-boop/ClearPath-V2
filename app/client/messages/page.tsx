import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { ClientMessagesContent } from './ClientMessagesContent'

/**
 * Client messages page: single thread with their coach.
 * Resolves client by user email, then coach name from workspace.
 */
export default async function ClientMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    redirect('/login')
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, workspace_id')
    .eq('email', user.email)
    .maybeSingle()

  if (!client) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">
          We couldn&apos;t find your client record. Please contact your coach.
        </p>
      </main>
    )
  }

  const { data: coachRow } = await supabase
    .from('coaches')
    .select('user_id')
    .eq('workspace_id', client.workspace_id)
    .limit(1)
    .maybeSingle()

  let coachName = 'Your coach'
  if (coachRow?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', coachRow.user_id)
      .maybeSingle()
    if (profile) {
      coachName = profile.display_name?.trim() || profile.full_name?.trim() || coachName
    }
  }

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <ClientMessagesContent clientId={client.id} coachName={coachName} />
    </main>
  )
}
