import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { uploadMp4FromUrl } from '@/lib/drive-import/supabase-video-storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function verifyCloudConvertSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CLOUDCONVERT_WEBHOOK_SECRET?.trim()
  if (!secret || !signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(signatureHeader.trim(), 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

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

async function fetchCloudConvertJob(jobId: string): Promise<CcJobData | null> {
  const key = process.env.CLOUDCONVERT_API_KEY
  if (!key) return null
  const res = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: CcJobData }
  return json.data ?? null
}

function exportUrlFromTasks(tasks: CcTask[] | undefined): string | null {
  const exportTask = tasks?.find((t) => t.operation === 'export/url' && t.status === 'finished')
  return exportTask?.result?.files?.[0]?.url ?? null
}

/**
 * POST /api/webhooks/cloudconvert
 *
 * **With CLOUDCONVERT_WEBHOOK_SECRET:** validates HMAC (account webhook in CloudConvert dashboard).
 * **Without secret:** requires `job.id` in JSON body and re-fetches the job from CloudConvert
 * (works with per-job webhooks that may not include a signing secret you control).
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const webhookSecret = process.env.CLOUDCONVERT_WEBHOOK_SECRET?.trim()
  const useHmac = Boolean(webhookSecret)
  const signatureValid = verifyCloudConvertSignature(rawBody, request.headers.get('CloudConvert-Signature'))

  if (useHmac && !signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: string
  let job: CcJobData
  try {
    const json = JSON.parse(rawBody) as { event?: string; job?: CcJobData }
    event = json.event ?? ''
    job = json.job ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!useHmac) {
    const jobId = job.id
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'job.id required when CLOUDCONVERT_WEBHOOK_SECRET is unset' }, { status: 400 })
    }
    const remote = await fetchCloudConvertJob(jobId)
    if (!remote) {
      return NextResponse.json({ error: 'Could not load job from CloudConvert' }, { status: 401 })
    }
    job = remote
    if (remote.status === 'error') {
      event = 'job.failed'
    } else if (remote.status === 'finished') {
      event = 'job.finished'
    } else {
      return NextResponse.json({ ok: true, pending: true })
    }
  }

  const tag = (job.tag ?? '').trim()
  if (!uuidRe.test(tag)) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const supabase = createServiceClient()

  if (event === 'job.failed') {
    await supabase
      .from('videos')
      .update({
        processing_status: 'failed',
        processing_error: 'CloudConvert job failed',
      })
      .eq('id', tag)
      .eq('processing_status', 'processing')
    return NextResponse.json({ ok: true })
  }

  if (event !== 'job.finished') {
    return NextResponse.json({ ok: true })
  }

  const mp4Url = exportUrlFromTasks(job.tasks)
  if (!mp4Url) {
    await supabase
      .from('videos')
      .update({
        processing_status: 'failed',
        processing_error: 'No export URL from CloudConvert',
      })
      .eq('id', tag)
      .eq('processing_status', 'processing')
    return NextResponse.json({ ok: true })
  }

  const { data: row } = await supabase
    .from('videos')
    .select('id, processing_status')
    .eq('id', tag)
    .maybeSingle()

  if (!row || row.processing_status !== 'processing') {
    return NextResponse.json({ ok: true })
  }

  const storagePath = `imports/${tag}.mp4`

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
      .eq('id', tag)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Supabase Storage upload failed'
    await supabase
      .from('videos')
      .update({ processing_status: 'failed', processing_error: msg })
      .eq('id', tag)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
