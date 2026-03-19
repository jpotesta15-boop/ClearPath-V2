import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchCloudConvertJob, finalizeFromCloudConvertJobId } from '@/lib/drive-import/cloudconvert-finalize'

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
  if (!job.id || typeof job.id !== 'string') {
    return NextResponse.json({ error: 'Missing CloudConvert job id' }, { status: 400 })
  }
  const result = await finalizeFromCloudConvertJobId({
    supabase,
    videoId: tag,
    jobId: job.id,
  })
  if (result.state === 'failed') {
    return NextResponse.json({ error: result.message ?? 'Finalize failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, state: result.state })
}
