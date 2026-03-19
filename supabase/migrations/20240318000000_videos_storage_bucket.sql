-- Public bucket for Drive-import MP4s (playback via videos.playback_url)
-- Service role uploads from /api/webhooks/cloudconvert; anyone with URL can read (path uses UUID).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  524288000,
  ARRAY['video/mp4'::text, 'video/quicktime'::text, 'video/webm'::text]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "videos_storage_select_public" ON storage.objects;
CREATE POLICY "videos_storage_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'videos');
