import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getClientId } from '@/lib/config'

/**
 * Server Supabase client for Server Components, Server Actions, and API routes.
 * Uses next/headers cookies and syncs profiles.tenant_id for RLS.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. See https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  const cookieStore = await cookies()
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components (e.g. during redirect)
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const clientId = getClientId()
  if (user && clientId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.tenant_id !== clientId) {
      await supabase
        .from('profiles')
        .update({ tenant_id: clientId })
        .eq('id', user.id)
    }
  }

  return supabase
}

/**
 * Server client for middleware (edge). Pass request and response so cookies
 * can be read from the request and written to the response for session refresh.
 */
export function createServerClientForMiddleware(
  request: NextRequest,
  response: NextResponse
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
    )
  }
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
