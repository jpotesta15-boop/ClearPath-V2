import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { recurringAvailabilityCreateSchema } from '@/lib/validations'

/**
 * GET /api/availability — all recurring_availability rules for the workspace. Coach only.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('recurring_availability')
      .select('id, workspace_id, coach_id, day_of_week, start_time, end_time, label, session_product_id, is_active, created_at')
      .eq('workspace_id', coach.workspace_id)
      .eq('coach_id', user.id)
      .order('day_of_week')
      .order('start_time')

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load availability' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/availability — create a recurring availability rule. Coach only. Rate limit 60/min.
 */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`availability:${ip}`, { windowMs: 60_000, max: 60 })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests — try again in a minute' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = recurringAvailabilityCreateSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { dayOfWeek, startTime, endTime, label, sessionProductId } = parsed.data
    const { data, error } = await supabase
      .from('recurring_availability')
      .insert({
        workspace_id: coach.workspace_id,
        coach_id: user.id,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        label: label?.trim() || null,
        session_product_id: sessionProductId || null,
        is_active: true,
      })
      .select('id, day_of_week, start_time, end_time, label, session_product_id, is_active, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create availability' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
