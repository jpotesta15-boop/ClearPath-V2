-- Session 13: Video library — extend videos for Drive import, add google_drive_connections.
-- RLS: current_workspace_id() for both tables.

-- ---------- videos: add columns for Drive import and processing ----------
-- (videos table and workspace_id already exist from base + add_workspace_id)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS drive_file_name TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'queued';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS playback_url TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'supabase';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS n8n_execution_id TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Allow url to be null for imported videos (set when ready)
ALTER TABLE public.videos ALTER COLUMN url DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'videos_processing_status_check'
  ) THEN
    ALTER TABLE public.videos
    ADD CONSTRAINT videos_processing_status_check
    CHECK (processing_status IN ('queued', 'processing', 'ready', 'failed', 'deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_videos_workspace_id ON public.videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_coach_id ON public.videos(coach_id);
CREATE INDEX IF NOT EXISTS idx_videos_processing_status ON public.videos(processing_status);
CREATE INDEX IF NOT EXISTS idx_videos_workspace_status ON public.videos(workspace_id, processing_status);

-- ---------- google_drive_connections: one per workspace ----------
CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  google_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_google_drive_connections_workspace ON public.google_drive_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_drive_connections_coach ON public.google_drive_connections(coach_id);

ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_drive_connections_select_workspace" ON public.google_drive_connections;
CREATE POLICY "google_drive_connections_select_workspace" ON public.google_drive_connections
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "google_drive_connections_insert_workspace" ON public.google_drive_connections;
CREATE POLICY "google_drive_connections_insert_workspace" ON public.google_drive_connections
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "google_drive_connections_update_workspace" ON public.google_drive_connections;
CREATE POLICY "google_drive_connections_update_workspace" ON public.google_drive_connections
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "google_drive_connections_delete_workspace" ON public.google_drive_connections;
CREATE POLICY "google_drive_connections_delete_workspace" ON public.google_drive_connections
  FOR DELETE USING (workspace_id = current_workspace_id());
