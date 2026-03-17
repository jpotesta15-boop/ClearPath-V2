import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/videos/[id] — fetch one video (for client program view or playback).
 * Returns video if in workspace (coach) or client has access via program.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: video, error } = await supabase
      .from('videos')
      .select('id, title, description, processing_status, playback_url, thumbnail_url, duration_seconds, file_size_bytes')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load video' },
        { status: 500 }
      )
    }
    if (!video) {
      return NextResponse.json(
        { error: "We couldn't find that video — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: video })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/videos/[id] — soft delete (set deleted_at). Coach only.
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

    const { error } = await supabase
      .from('videos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete video' },
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
