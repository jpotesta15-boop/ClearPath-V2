import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { inviteClientSchema } from '@/lib/validations'

/**
 * POST /api/invite-client — send invite email to client (coach only).
 * Rate limit: 20 requests per minute per IP (11-auth §5, 04-client-management).
 * Redirect in email points to /auth/set-password.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`invite-client:${ip}`, {
      windowMs: 60_000,
      max: 20,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many invites — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = inviteClientSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (request.headers.get('x-forwarded-proto') && request.headers.get('host')
        ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
        : 'http://localhost:3000')
    const redirectTo = `${baseUrl.replace(/\/$/, '')}/auth/set-password`

    const service = createServiceClient()
    const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        data: {
          role: 'client',
          workspace_id: coach.workspace_id,
        },
        redirectTo,
      }
    )

    if (inviteError) {
      const msg = inviteError.message || 'Failed to send invite'
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        return NextResponse.json(
          { error: 'This email already has an account' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: msg },
        { status: 500 }
      )
    }

    if (!inviteData?.user) {
      return NextResponse.json(
        { error: 'Invite could not be sent — please try again' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: 'Invite sent' })
  } catch (err) {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
