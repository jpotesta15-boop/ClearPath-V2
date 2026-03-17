import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createServerClientForMiddleware } from '@/lib/supabase-server'

function isSupabaseNotConfigured(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('Supabase is not configured') || msg.includes('URL and Key are required')
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Rate limit /login and /forgot-password: 30 requests/min per IP (11-auth-permissions §4.1)
  if (pathname === '/login' || pathname === '/forgot-password') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`login:${ip}`, { windowMs: 60_000, max: 30 })
    if (!success) {
      const res = new NextResponse('Too Many Requests', { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }
  }

  // /onboarding — authenticated coaches only; if completed_onboarding → /coach/dashboard
  if (pathname.startsWith('/onboarding')) {
    const response = NextResponse.next({ request })
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return NextResponse.next({ request })
      throw err
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.redirect(new URL('/client/portal', request.url))
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (coach?.workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('completed_onboarding')
        .eq('id', coach.workspace_id)
        .maybeSingle()
      if (workspace?.completed_onboarding) {
        return NextResponse.redirect(new URL('/coach/dashboard', request.url))
      }
    }
    return response
  }

  // Session check for /coach/*, /client/*, /billing — redirect to /login?next=pathname if no session
  if (pathname.startsWith('/coach') || pathname.startsWith('/client') || pathname === '/billing') {
    const response = NextResponse.next({ request })
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return NextResponse.next({ request })
      throw err
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    // /billing is coach-only; clients go to portal
    if (pathname === '/billing' && profile?.role !== 'coach') {
      return NextResponse.redirect(new URL(profile?.role === 'client' ? '/client/portal' : '/coach/dashboard', request.url))
    }
    // Coach with incomplete onboarding → /onboarding
    if (profile?.role === 'coach') {
      const { data: coach } = await supabase
        .from('coaches')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (coach?.workspace_id) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('completed_onboarding')
          .eq('id', coach.workspace_id)
          .maybeSingle()
        if (!workspace?.completed_onboarding) {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
        // Subscription check for /coach/* only (not /billing)
        if (pathname.startsWith('/coach')) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('status, current_period_end')
            .eq('workspace_id', coach.workspace_id)
            .maybeSingle()
          if (sub) {
            if (sub.status === 'past_due') {
              return NextResponse.redirect(new URL('/billing?warning=past_due', request.url))
            }
            if (sub.status === 'cancelled' && sub.current_period_end) {
              const end = new Date(sub.current_period_end).getTime()
              if (end < Date.now()) {
                return NextResponse.redirect(new URL('/billing?warning=cancelled', request.url))
              }
            }
          }
        }
      }
    }
    return response
  }

  // /api/*: CORS and OPTIONS only; auth enforced per route (11-auth §4.1)
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next()
    const origin = request.headers.get('origin')
    const allowed = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.split(',').map((o) => o.trim()).filter(Boolean)
      : [request.nextUrl.origin]
    if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/coach/:path*',
    '/client/:path*',
    '/billing',
    '/onboarding',
    '/onboarding/:path*',
    '/login',
    '/forgot-password',
  ],
}
