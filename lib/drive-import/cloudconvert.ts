const CC_API = 'https://api.cloudconvert.com/v2'

export function buildDriveMediaUrl(fileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
}

/**
 * Start async convert job: Drive file (via authed URL) → MP4 → temporary export URL.
 * CloudConvert downloads directly from Google; ClearPath/n8n never hold the binary.
 */
export async function createDriveToMp4Job(params: {
  driveFileId: string
  filename: string
  googleAccessToken: string
  webhookUrl: string
  tag: string
}): Promise<{ jobId: string }> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY
  if (!apiKey) throw new Error('CLOUDCONVERT_API_KEY is not set')

  const safeName =
    params.filename.replace(/[^\w.\-()+ ]/g, '_').slice(0, 200) || 'video.bin'

  const body = {
    tag: params.tag,
    webhook_url: params.webhookUrl,
    tasks: {
      import_from_drive: {
        operation: 'import/url',
        url: buildDriveMediaUrl(params.driveFileId),
        filename: safeName,
        headers: {
          Authorization: `Bearer ${params.googleAccessToken}`,
        },
      },
      convert_mp4: {
        operation: 'convert',
        input: 'import_from_drive',
        output_format: 'mp4',
      },
      export_mp4_url: {
        operation: 'export/url',
        input: 'convert_mp4',
      },
    },
  }

  const res = await fetch(`${CC_API}/jobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as { data?: { id?: string }; message?: string }
  if (!res.ok || !json.data?.id) {
    throw new Error(json.message ?? `CloudConvert job create failed (${res.status})`)
  }
  return { jobId: json.data.id }
}
