import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createModuleSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/programs/[id]/modules — add module to program. Coach only.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: programId } = await context.params
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
    const parsed = createModuleSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: maxPos } = await supabase
      .from('program_modules')
      .select('position')
      .eq('program_id', programId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const position = parsed.data.position ?? (maxPos ? maxPos.position + 1 : 0)

    const { data: row, error } = await supabase
      .from('program_modules')
      .insert({
        program_id: programId,
        workspace_id: coach.workspace_id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        position,
      })
      .select('id, program_id, title, description, position, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not add module' },
        { status: 500 }
      )
    }

    const { data: prog } = await supabase.from('programs').select('total_modules').eq('id', programId).single()
    if (prog) {
      await supabase
        .from('programs')
        .update({ total_modules: (prog.total_modules ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', programId)
    }

    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
