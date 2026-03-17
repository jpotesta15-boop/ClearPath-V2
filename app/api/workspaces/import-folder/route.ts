import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { z } from 'zod'

const patchBodySchema = z.object({
  folderId: z.string().trim().min(1).nullable(),
})

/**
 * GET /api/workspaces/import-folder — get current coach's Google Drive import folder ID.
 * Coach only.
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

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('google_drive_import_folder_id')
      .eq('id', coach.workspace_id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message ?? 'Could not load workspace' }, { status: 500 })
    }
    return NextResponse.json({
      folderId: workspace?.google_drive_import_folder_id ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workspaces/import-folder — set current coach's Google Drive import folder ID.
 * Body: { folderId: string | null }. Coach only.
 */
export async function PATCH(request: Request) {
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

    const body = await request.json()
    const parsed = patchBodySchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { error } = await supabase
      .from('workspaces')
      .update({
        google_drive_import_folder_id: parsed.data.folderId,
      })
      .eq('id', coach.workspace_id)

    if (error) {
      return NextResponse.json(
        { error: error.message ?? 'Could not update import folder' },
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
