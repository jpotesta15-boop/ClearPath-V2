import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveWorkspaceForDriveFolder } from '@/lib/drive-import/resolve-workspace-folder'
import { refreshGoogleAccessToken } from '@/lib/drive-import/google-token'
import { createDriveToMp4Job } from '@/lib/drive-import/cloudconvert'
import { withVercelProtectionBypassQuery } from '@/lib/vercel-protection-bypass'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  folderId: z.string().min(1),
  driveFileId: z.string().min(1),
  driveFileName: z.string().optional().nullable(),
})

function appBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (u) return u.replace(/\/$/, '')
  return 'http://localhost:3000'
}

function titleFromDriveName(name: string | null | undefined): string {
  const n = (name ?? 'video').trim() || 'video'
  return n.replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '')
}

/**
 * GET — only for sanity checks (browser/curl without -X POST). Real import is POST.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/videos/import-from-drive',
      method: 'POST',
      body: { folderId: 'string', driveFileId: 'string', driveFileName: 'string (optional)' },
      headers: { 'X-Clearpath-Secret': 'must match N8N_CALLBACK_SECRET' },
      note: 'Opening this URL in a browser uses GET; n8n must use POST with JSON body.',
    },
    { status: 200, headers: { Allow: 'POST, GET' } }
  )
}

/**
 * POST /api/videos/import-from-drive — n8n calls this when a new file appears in the import folder.
 * Processing runs on ClearPath + CloudConvert + Supabase Storage (no large binaries in n8n).
 * Auth: X-Clearpath-Secret = N8N_CALLBACK_SECRET.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-clearpath-secret') ?? request.headers.get('X-Clearpath-Secret')
  const expected = process.env.N8N_CALLBACK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.CLOUDCONVERT_API_KEY) {
    return NextResponse.json(
      { error: 'Server misconfigured: CLOUDCONVERT_API_KEY' },
      { status: 503 }
    )
  }
  try {
    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 })
    }

    const supabase = createServiceClient()
    const resolved = await resolveWorkspaceForDriveFolder(supabase, parsed.data.folderId)
    if (!resolved) {
      return NextResponse.json({ error: 'Workspace not found for this folder' }, { status: 404 })
    }

    const { data: conn, error: connErr } = await supabase
      .from('google_drive_connections')
      .select('refresh_token')
      .eq('workspace_id', resolved.workspaceId)
      .maybeSingle()

    if (connErr || !conn?.refresh_token) {
      return NextResponse.json(
        {
          error:
            'Google Drive not connected for this workspace. In ClearPath → Videos, click “Connect Google Drive” (same Google account that owns the import folder).',
        },
        { status: 400 }
      )
    }

    let accessToken: string
    try {
      const t = await refreshGoogleAccessToken(conn.refresh_token)
      accessToken = t.access_token
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Token refresh failed'
      return NextResponse.json(
        { error: `Google Drive access failed: ${msg}. Reconnect Google in Videos settings.` },
        { status: 401 }
      )
    }

    const driveName = parsed.data.driveFileName?.trim() || 'video.mp4'
    const title = titleFromDriveName(driveName)

    const { data: video, error: insErr } = await supabase
      .from('videos')
      .insert({
        workspace_id: resolved.workspaceId,
        coach_id: resolved.coachId,
        title,
        description: null,
        drive_file_id: parsed.data.driveFileId,
        drive_file_name: driveName,
        processing_status: 'processing',
        processing_error: null,
        url: null,
        playback_url: null,
        thumbnail_url: null,
        storage_provider: 'supabase',
      })
      .select('id')
      .single()

    if (insErr || !video) {
      return NextResponse.json(
        { error: insErr?.message ?? 'Could not create video row' },
        { status: 500 }
      )
    }

    const videoId = video.id as string
    const webhookUrl = withVercelProtectionBypassQuery(`${appBaseUrl()}/api/webhooks/cloudconvert`)

    try {
      const { jobId } = await createDriveToMp4Job({
        driveFileId: parsed.data.driveFileId,
        filename: driveName,
        googleAccessToken: accessToken,
        webhookUrl,
        tag: videoId,
      })

      await supabase.from('videos').update({ n8n_execution_id: jobId }).eq('id', videoId)

      return NextResponse.json(
        {
          data: {
            videoId,
            cloudconvertJobId: jobId,
            message: 'Processing started. Video will appear as ready when conversion finishes.',
          },
        },
        { status: 202 }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'CloudConvert error'
      await supabase
        .from('videos')
        .update({ processing_status: 'failed', processing_error: msg })
        .eq('id', videoId)
      return NextResponse.json({ error: msg, videoId }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
