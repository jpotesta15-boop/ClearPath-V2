import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateProgramSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/programs/[id] — full program with modules and content blocks, ordered by position.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
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

    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, workspace_id, coach_id, title, description, thumbnail_url, status, total_modules, created_at, updated_at')
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: modules, error: modulesError } = await supabase
      .from('program_modules')
      .select('id, program_id, title, description, position, created_at, updated_at')
      .eq('program_id', id)
      .order('position', { ascending: true })

    if (modulesError) {
      return NextResponse.json(
        { error: modulesError.message || 'Could not load modules' },
        { status: 500 }
      )
    }

    const moduleIds = (modules ?? []).map((m) => m.id)
    let content: { id: string; module_id: string; content_type: string; title: string | null; body: string | null; url: string | null; video_id: string | null; file_url: string | null; position: number }[] = []
    if (moduleIds.length > 0) {
      const { data: contentRows } = await supabase
        .from('program_content')
        .select('id, module_id, content_type, title, body, url, video_id, file_url, position, created_at, updated_at')
        .in('module_id', moduleIds)
        .order('position', { ascending: true })
      content = (contentRows ?? []) as typeof content
    }

    const modulesWithContent = (modules ?? []).map((m) => ({
      ...m,
      content: content.filter((c) => c.module_id === m.id),
    }))

    return NextResponse.json({
      data: {
        ...program,
        modules: modulesWithContent,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/programs/[id] — update title, description, status. Coach only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
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
    const parsed = updateProgramSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.status !== undefined) updates.status = parsed.data.status

    const { data: row, error } = await supabase
      .from('programs')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .select('id, title, description, status, total_modules, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update program' },
        { status: 500 }
      )
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
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

/**
 * DELETE /api/programs/[id] — soft delete: set status = archived. Coach only.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
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

    const { data: row, error } = await supabase
      .from('programs')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete program' },
        { status: 500 }
      )
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
