import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const fromN8nBodySchema = z.object({
  workspaceId: z.string().uuid(),
  coachId: z.string().uuid(),
  title: z.string().min(1),
  playbackUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  fileSizeBytes: z.number().int().nonnegative().optional().nullable(),
})

/**
 * POST /api/videos/from-n8n — create a video row when n8n finishes processing a file from the import folder.
 * Auth: X-Clearpath-Secret = N8N_CALLBACK_SECRET.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-clearpath-secret') ?? request.headers.get('X-Clearpath-Secret')
  const expected = process.env.N8N_CALLBACK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = fromN8nBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()
    const { data: video, error } = await supabase
      .from('videos')
      .insert({
        workspace_id: parsed.data.workspaceId,
        coach_id: parsed.data.coachId,
        title: parsed.data.title,
        description: null,
        url: parsed.data.playbackUrl,
        playback_url: parsed.data.playbackUrl,
        thumbnail_url: parsed.data.thumbnailUrl ?? null,
        duration_seconds: parsed.data.durationSeconds ?? null,
        file_size_bytes: parsed.data.fileSizeBytes ?? null,
        processing_status: 'ready',
        processed_at: now,
        storage_provider: 'supabase',
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message ?? 'Could not create video' }, { status: 500 })
    }
    return NextResponse.json({ data: { id: video.id } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
