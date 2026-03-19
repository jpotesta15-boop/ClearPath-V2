import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { finalizeFromCloudConvertJobId } from '@/lib/drive-import/cloudconvert-finalize'

const STATUS_VALUES = ['ready', 'processing', 'failed', 'queued'] as const
const FALLBACK_PROCESSING_AGE_MS = 90 * 1000
const FALLBACK_BATCH_SIZE = 3

async function runProcessingFallback(workspaceId: string) {
  const supabase = createServiceClient()
  const cutoffIso = new Date(Date.now() - FALLBACK_PROCESSING_AGE_MS).toISOString()
  const { data: staleRows } = await supabase
    .from('videos')
    .select('id, n8n_execution_id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('processing_status', ['processing', 'queued'])
    .not('n8n_execution_id', 'is', null)
    .lt('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(FALLBACK_BATCH_SIZE)

  if (!staleRows?.length) return

  for (const row of staleRows) {
    const jobId = (row.n8n_execution_id ?? '').trim()
    if (!jobId) continue
    await finalizeFromCloudConvertJobId({
      supabase,
      videoId: row.id as string,
      jobId,
    })
  }
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim()

    // Safety net: if a webhook is missed, finalize a few stale processing items
    // while the coach is actively loading the library.
    await runProcessingFallback(coach.workspace_id).catch(() => {})

    let query = supabase
      .from('videos')
      .select('id, workspace_id, coach_id, title, description, drive_file_id, drive_file_name, processing_status, processing_error, playback_url, thumbnail_url, duration_seconds, file_size_bytes, storage_provider, created_at, processed_at')
      .eq('workspace_id', coach.workspace_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      query = query.eq('processing_status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load videos' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
