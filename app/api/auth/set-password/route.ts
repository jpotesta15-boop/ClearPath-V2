import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { setPasswordSchema } from '@/lib/validations'

/**
 * POST /api/auth/set-password — set password after invite (session required).
 * Rate limit: 5 attempts per 15 minutes per IP (11-auth §7.1).
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`set-password:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait 15 minutes and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Your link may have expired. Ask your coach to resend the invite.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = setPasswordSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) {
      const msg = error.message || 'Could not set password'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
