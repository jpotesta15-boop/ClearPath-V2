import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS.
 * Use only in API routes or server code that must perform admin actions
 * (e.g. inviteUserByEmail, createUser). Never expose to the client.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
