export type Video = {
  id: string
  workspace_id: string
  coach_id: string
  title: string
  description: string | null
  drive_file_id: string | null
  drive_file_name: string | null
  processing_status: 'queued' | 'processing' | 'ready' | 'failed' | 'deleted'
  processing_error: string | null
  playback_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  storage_provider: string | null
  created_at: string
  processed_at: string | null
}
