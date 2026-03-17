import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client. Use in Client Components only.
 * Session is stored in cookies via @supabase/ssr.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
