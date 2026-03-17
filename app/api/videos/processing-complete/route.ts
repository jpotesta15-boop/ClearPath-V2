import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const callbackBodySchema = z.object({
  videoId: z.string().uuid(),
  status: z.enum(['ready', 'failed']),
  playbackUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  fileSizeBytes: z.number().int().nonnegative().optional().nullable(),
  error: z.string().optional().nullable(),
})

/**
 * POST /api/videos/processing-complete — called by n8n when video processing is done.
 * Header X-Clearpath-Secret must match N8N_CALLBACK_SECRET. Uses service role (no user session).
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-clearpath-secret') ?? request.headers.get('X-Clearpath-Secret')
  const expected = process.env.N8N_CALLBACK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = callbackBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (parsed.data.status === 'ready') {
      const updates: Record<string, unknown> = {
        processing_status: 'ready',
        processed_at: new Date().toISOString(),
      }
      if (parsed.data.playbackUrl != null) updates.playback_url = parsed.data.playbackUrl
      if (parsed.data.thumbnailUrl != null) updates.thumbnail_url = parsed.data.thumbnailUrl
      if (parsed.data.durationSeconds != null) updates.duration_seconds = parsed.data.durationSeconds
      if (parsed.data.fileSizeBytes != null) updates.file_size_bytes = parsed.data.fileSizeBytes
      if (parsed.data.playbackUrl) updates.url = parsed.data.playbackUrl

      await supabase
        .from('videos')
        .update(updates)
        .eq('id', parsed.data.videoId)
    } else {
      await supabase
        .from('videos')
        .update({
          processing_status: 'failed',
          processing_error: parsed.data.error ?? 'Processing failed',
        })
        .eq('id', parsed.data.videoId)
    }

    return new NextResponse(null, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
