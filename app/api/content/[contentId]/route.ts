import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateContentSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ contentId: string }> }

/**
 * PATCH /api/content/[contentId] — update content block. Coach only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { contentId } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-content:${user.id}`, {
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
    const parsed = updateContentSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.body !== undefined) updates.body = parsed.data.body
    if (parsed.data.url !== undefined) updates.url = parsed.data.url
    if (parsed.data.videoId !== undefined) updates.video_id = parsed.data.videoId
    if (parsed.data.fileUrl !== undefined) updates.file_url = parsed.data.fileUrl
    if (parsed.data.position !== undefined) updates.position = parsed.data.position

    const { data: row, error } = await supabase
      .from('program_content')
      .update(updates)
      .eq('id', contentId)
      .eq('workspace_id', coach.workspace_id)
      .select('id, module_id, content_type, title, body, url, video_id, file_url, position, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update content' },
        { status: 500 }
      )
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that content — it may have been deleted" },
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
 * DELETE /api/content/[contentId] — hard delete content block. Coach only.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { contentId } = await context.params
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

    const { error } = await supabase
      .from('program_content')
      .delete()
      .eq('id', contentId)
      .eq('workspace_id', coach.workspace_id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete content' },
        { status: 500 }
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
