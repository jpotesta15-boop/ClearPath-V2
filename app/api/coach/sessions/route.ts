import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSessionSchema } from '@/lib/validations'
import { addMinutes } from 'date-fns'

/**
 * GET /api/coach/sessions — list coach's upcoming sessions (next 5). Coach only.
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
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status, clients(first_name, last_name)')
      .eq('coach_id', user.id)
      .gte('scheduled_time', now)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_time', { ascending: true })
      .limit(5)
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/coach/sessions — create a session (coach only).
 * Body: client_id, scheduled_time (ISO), duration_minutes (optional, default 60), notes, availability_slot_id, session_product_id, status (optional, default 'confirmed').
 * Returns 200 { data: { id, conflict?: true } } or 400/403/409 (conflict = overlapping session).
 */
export async function POST(request: Request) {
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ')
      return NextResponse.json({ error: msg || 'Validation failed' }, { status: 400 })
    }

    const { client_id, scheduled_time, duration_minutes = 60, notes, availability_slot_id, session_product_id, status } = parsed.data
    const start = new Date(scheduled_time)
    const end = addMinutes(start, duration_minutes)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found or not in your workspace' }, { status: 404 })
    }

    const { data: existingSessions } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes')
      .eq('coach_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .lt('scheduled_time', endIso)

    const hasOverlap = (existingSessions ?? []).some((s) => {
      const sStart = new Date(s.scheduled_time)
      const sEnd = s.end_time ? new Date(s.end_time) : addMinutes(sStart, s.duration_minutes ?? 60)
      return sEnd > start
    })
    if (hasOverlap) {
      return NextResponse.json(
        { error: 'You already have a session at this time', conflict: true },
        { status: 409 }
      )
    }

    const { data: inserted, error } = await supabase
      .from('sessions')
      .insert({
        coach_id: user.id,
        client_id,
        workspace_id: coach.workspace_id,
        scheduled_time: startIso,
        end_time: endIso,
        duration_minutes,
        status,
        notes: notes ?? null,
        availability_slot_id: availability_slot_id ?? null,
        session_product_id: session_product_id ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { id: inserted.id } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
