import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_BUCKET = 'videos'

export function getVideoStorageBucket(): string {
  return process.env.SUPABASE_VIDEO_BUCKET?.trim() || DEFAULT_BUCKET
}

/**
 * Download MP4 from a temporary URL (e.g. CloudConvert export) and upload to Supabase Storage.
 * Returns a public URL for <video src="..."> when the bucket is public.
 */
export async function uploadMp4FromUrl(
  supabase: SupabaseClient,
  remoteMp4Url: string,
  storagePath: string
): Promise<{ publicUrl: string; bytes: number | null }> {
  const res = await fetch(remoteMp4Url)
  if (!res.ok) {
    throw new Error(`Failed to download MP4 (${res.status})`)
  }
  const buf = await res.arrayBuffer()
  const bytes = buf.byteLength
  const bucket = getVideoStorageBucket()

  const { data, error } = await supabase.storage.from(bucket).upload(storagePath, buf, {
    contentType: 'video/mp4',
    upsert: true,
  })

  if (error) {
    throw new Error(error.message || 'Supabase Storage upload failed')
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { publicUrl: pub.publicUrl, bytes }
}
