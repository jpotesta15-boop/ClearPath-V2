import { createHash } from 'crypto'

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string): string {
  const keys = Object.keys(params).sort()
  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&')
  return createHash('sha1').update(toSign + apiSecret).digest('hex')
}

export type CloudinaryVideoResult = {
  secure_url: string
  duration?: number
  bytes?: number
}

/**
 * Tell Cloudinary to fetch a remote MP4 URL and host it for playback.
 */
export async function uploadVideoFromUrl(remoteUrl: string): Promise<CloudinaryVideoResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are required')
  }

  // Cloudinary: sign timestamp only (do not include `file` in signature).
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signCloudinaryParams({ timestamp }, apiSecret)

  const form = new URLSearchParams()
  form.set('file', remoteUrl)
  form.set('api_key', apiKey)
  form.set('timestamp', String(timestamp))
  form.set('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  const data = (await res.json()) as {
    secure_url?: string
    duration?: number
    bytes?: number
    error?: { message?: string }
  }
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? `Cloudinary upload failed (${res.status})`)
  }
  return {
    secure_url: data.secure_url,
    duration: data.duration,
    bytes: data.bytes,
  }
}
