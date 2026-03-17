import { NextResponse } from 'next/server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const MAX_AGE_MS = 15 * 60 * 1000 // only confirm users created in the last 15 minutes

/**
 * POST /api/auth/confirm-signup — optionally confirm a just-created user so they can sign in without email.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Body: { userId: string }. Rate limit: 5 per 15 min per IP.
 * If the service role key is not set, returns 503 with instructions to confirm in Supabase Dashboard.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`signup:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts. Please try again in 15 minutes.' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key?.trim()) {
      return NextResponse.json(
        {
          error:
            'Email confirmation is required. Confirm your account in Supabase Dashboard (Authentication → Users → select your user → Confirm user), or sign in after confirming the link sent to your email.',
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : null
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 }
      )
    }

    const { createServiceClient } = await import('@/lib/supabase/service')
    const service = createServiceClient()

    const { data: userData, error: getUserError } = await service.auth.admin.getUserById(userId)
    if (getUserError || !userData?.user) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      )
    }

    const createdAt = userData.user.created_at
      ? new Date(userData.user.created_at).getTime()
      : 0
    if (Date.now() - createdAt > MAX_AGE_MS) {
      return NextResponse.json(
        { error: 'This link has expired. Please sign in or confirm your email from the dashboard.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await service.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message ?? 'Could not confirm account.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again.' },
      { status: 500 }
    )
  }
}
