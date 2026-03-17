import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateModuleSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string; moduleId: string }> }

/**
 * PATCH /api/programs/[id]/modules/[moduleId] — update module. Coach only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: programId, moduleId } = await context.params
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

    const { data: program } = await supabase
      .from('programs')
      .select('id')
      .eq('id', programId)
      .eq('workspace_id', coach.workspace_id)
      .single()
    if (!program) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateModuleSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.position !== undefined) updates.position = parsed.data.position

    const { data: row, error } = await supabase
      .from('program_modules')
      .update(updates)
      .eq('id', moduleId)
      .eq('program_id', programId)
      .eq('workspace_id', coach.workspace_id)
      .select('id, program_id, title, description, position, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update module' },
        { status: 500 }
      )
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that module — it may have been deleted" },
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
 * DELETE /api/programs/[id]/modules/[moduleId] — delete module and all its content. Coach only.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: programId, moduleId } = await context.params
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

    const { data: mod } = await supabase
      .from('program_modules')
      .select('id')
      .eq('id', moduleId)
      .eq('program_id', programId)
      .eq('workspace_id', coach.workspace_id)
      .single()
    if (!mod) {
      return NextResponse.json(
        { error: "We couldn't find that module — it may have been deleted" },
        { status: 404 }
      )
    }

    await supabase.from('program_content').delete().eq('module_id', moduleId)
    const { error: delError } = await supabase
      .from('program_modules')
      .delete()
      .eq('id', moduleId)
      .eq('workspace_id', coach.workspace_id)

    if (delError) {
      return NextResponse.json(
        { error: delError.message || 'Could not delete module' },
        { status: 500 }
      )
    }

    const { data: prog } = await supabase.from('programs').select('total_modules').eq('id', programId).single()
    if (prog && (prog.total_modules ?? 0) > 0) {
      await supabase
        .from('programs')
        .update({ total_modules: Math.max(0, (prog.total_modules ?? 0) - 1), updated_at: new Date().toISOString() })
        .eq('id', programId)
    }

    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
