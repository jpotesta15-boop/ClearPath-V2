import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createPackageSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/packages — list session packages for the coach's workspace.
 */
export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from('session_packages')
      .select('id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at')
      .eq('workspace_id', coach.workspace_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load packages' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/packages — create a session package. Coach only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-packages:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
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
    const parsed = createPackageSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('session_packages')
      .insert({
        workspace_id: coach.workspace_id,
        coach_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        price_cents: parsed.data.price_cents,
        currency: parsed.data.currency ?? 'usd',
        duration_minutes: parsed.data.duration_minutes ?? 60,
        session_type: parsed.data.session_type ?? null,
        is_active: parsed.data.is_active ?? true,
      })
      .select('id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create package' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
