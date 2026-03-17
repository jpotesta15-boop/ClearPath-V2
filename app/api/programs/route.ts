import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createProgramSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/programs — all programs for the coach's workspace.
 * Query: ?status=draft|published|archived
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim()

    let query = supabase
      .from('programs')
      .select('id, workspace_id, coach_id, title, description, thumbnail_url, status, total_modules, created_at, updated_at')
      .eq('workspace_id', coach.workspace_id)
      .order('updated_at', { ascending: false })

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: programs, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load programs' },
        { status: 500 }
      )
    }
    const list = programs ?? []
    if (list.length === 0) {
      return NextResponse.json({ data: [] })
    }
    const programIds = list.map((p) => p.id)
    const { data: assignments } = await supabase
      .from('client_programs')
      .select('program_id')
      .in('program_id', programIds)
    const assignedCountByProgram: Record<string, number> = {}
    for (const a of assignments ?? []) {
      assignedCountByProgram[a.program_id] = (assignedCountByProgram[a.program_id] ?? 0) + 1
    }
    const data = list.map((p) => ({
      ...p,
      assigned_count: assignedCountByProgram[p.id] ?? 0,
    }))
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/programs — create program in draft status. Coach only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-programs:${user.id}`, {
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
    const parsed = createProgramSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('programs')
      .insert({
        workspace_id: coach.workspace_id,
        coach_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: 'draft',
        total_modules: 0,
      })
      .select('id, workspace_id, coach_id, title, description, status, total_modules, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create program' },
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
