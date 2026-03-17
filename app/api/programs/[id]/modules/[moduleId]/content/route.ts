import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createContentSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string; moduleId: string }> }

/**
 * POST /api/programs/[id]/modules/[moduleId]/content — add content block. Position = max + 1. Coach only.
 */
export async function POST(request: Request, context: RouteContext) {
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

    const body = await request.json()
    const parsed = createContentSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: maxPos } = await supabase
      .from('program_content')
      .select('position')
      .eq('module_id', moduleId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const position = maxPos ? maxPos.position + 1 : 0

    const { data: row, error } = await supabase
      .from('program_content')
      .insert({
        module_id: moduleId,
        workspace_id: coach.workspace_id,
        content_type: parsed.data.contentType,
        title: parsed.data.title ?? null,
        body: parsed.data.body ?? null,
        url: parsed.data.url ?? null,
        video_id: parsed.data.videoId ?? null,
        file_url: parsed.data.fileUrl ?? null,
        position,
      })
      .select('id, module_id, content_type, title, body, url, video_id, file_url, position, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not add content' },
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
