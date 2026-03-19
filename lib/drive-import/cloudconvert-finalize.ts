import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadMp4FromUrl } from '@/lib/drive-import/supabase-video-storage'

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CcTask = {
  operation?: string
  status?: string
  result?: { files?: Array<{ url?: string }> }
}

type CcJobData = {
  id?: string
  tag?: string
  status?: string
  tasks?: CcTask[]
}

export async function fetchCloudConvertJob(jobId: string): Promise<CcJobData | null> {
  const key = process.env.CLOUDCONVERT_API_KEY
  if (!key) return null
  const res = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: CcJobData }
  return json.data ?? null
}

function exportUrlFromTasks(tasks: CcTask[] | undefined): string | null {
  const exportTask = tasks?.find((t) => t.operation === 'export/url' && t.status === 'finished')
  return exportTask?.result?.files?.[0]?.url ?? null
}

export async function finalizeFromCloudConvertJobId(params: {
  supabase: SupabaseClient
  videoId: string
  jobId: string
}): Promise<{ state: 'ready' | 'pending' | 'failed' | 'ignored'; message?: string }> {
  const { supabase, videoId, jobId } = params
  const job = await fetchCloudConvertJob(jobId)
  if (!job) return { state: 'failed', message: 'Could not load job from CloudConvert' }

  const tag = (job.tag ?? '').trim()
  if (!uuidRe.test(videoId)) return { state: 'ignored' }
  if (tag && uuidRe.test(tag) && tag !== videoId) return { state: 'ignored' }

  if (job.status === 'error') {
    await supabase
      .from('videos')
      .update({
        processing_status: 'failed',
        processing_error: 'CloudConvert job failed',
      })
      .eq('id', videoId)
      .in('processing_status', ['processing', 'queued'])
    return { state: 'failed', message: 'CloudConvert job failed' }
  }

  if (job.status !== 'finished') {
    return { state: 'pending' }
  }

  const mp4Url = exportUrlFromTasks(job.tasks)
  if (!mp4Url) {
    await supabase
      .from('videos')
      .update({
        processing_status: 'failed',
        processing_error: 'No export URL from CloudConvert',
      })
      .eq('id', videoId)
      .in('processing_status', ['processing', 'queued'])
    return { state: 'failed', message: 'No export URL from CloudConvert' }
  }

  const { data: row } = await supabase
    .from('videos')
    .select('id, processing_status')
    .eq('id', videoId)
    .maybeSingle()

  if (!row || (row.processing_status !== 'processing' && row.processing_status !== 'queued')) {
    return { state: 'ignored' }
  }

  const storagePath = `imports/${videoId}.mp4`
  try {
    const up = await uploadMp4FromUrl(supabase, mp4Url, storagePath)
    const now = new Date().toISOString()
    await supabase
      .from('videos')
      .update({
        processing_status: 'ready',
        processed_at: now,
        url: up.publicUrl,
        playback_url: up.publicUrl,
        thumbnail_url: null,
        duration_seconds: null,
        file_size_bytes: up.bytes ?? null,
        processing_error: null,
      })
      .eq('id', videoId)
    return { state: 'ready' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Supabase Storage upload failed'
    await supabase
      .from('videos')
      .update({ processing_status: 'failed', processing_error: msg })
      .eq('id', videoId)
    return { state: 'failed', message: msg }
  }
}
