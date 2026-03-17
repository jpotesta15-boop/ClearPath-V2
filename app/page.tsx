import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

/**
 * Root page: requires login; redirects by role (11-auth §4.3).
 * Not in middleware matcher — protection is here.
 */
export default async function HomePage() {
  let supabase
  try {
    supabase = await createClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('Supabase is not configured') || message.includes('URL and Key are required')) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans text-[var(--color-text-primary)]">
          <h1 className="text-xl font-medium mb-2">Setup required</h1>
          <p className="text-[var(--color-text-secondary)] text-center max-w-md mb-4">
            Supabase is not configured. Add these to <code className="bg-[var(--color-surface)] px-1 rounded">.env.local</code>:
          </p>
          <pre className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-left text-sm overflow-x-auto max-w-md">
            {`NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`}
          </pre>
          <a
            href="https://supabase.com/dashboard/project/_/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-[var(--color-accent)] hover:underline"
          >
            Get these from your Supabase project → API settings
          </a>
        </div>
      )
    }
    throw err
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role
  if (role === 'coach') {
    redirect('/onboarding')
  }
  redirect('/client/portal')
}
