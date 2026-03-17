import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/videos/resolve-folder — resolve Google Drive folder ID to workspace and coach.
 * Used by n8n when a new file lands in a folder. Auth: X-Clearpath-Secret = N8N_CALLBACK_SECRET.
 */
export async function GET(request: Request) {
  const secret = request.headers.get('x-clearpath-secret') ?? request.headers.get('X-Clearpath-Secret')
  const expected = process.env.N8N_CALLBACK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')?.trim()
  if (!folderId) {
    return NextResponse.json({ error: 'Missing folderId' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .select('id')
      .eq('google_drive_import_folder_id', folderId)
      .maybeSingle()

    if (wsErr || !workspace) {
      return NextResponse.json({ error: 'Workspace not found for this folder' }, { status: 404 })
    }

    const { data: coach, error: coachErr } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('workspace_id', workspace.id)
      .limit(1)
      .maybeSingle()

    if (coachErr || !coach) {
      return NextResponse.json({ error: 'No coach found for this workspace' }, { status: 404 })
    }

    return NextResponse.json({
      workspaceId: workspace.id,
      coachId: coach.user_id,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
