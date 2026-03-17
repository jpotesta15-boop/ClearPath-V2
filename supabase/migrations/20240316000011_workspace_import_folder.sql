-- Store Google Drive import folder ID per workspace (folder-based video import, no OAuth).
-- n8n resolves folderId -> workspace/coach via this column.

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS google_drive_import_folder_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_import_folder
  ON public.workspaces(google_drive_import_folder_id)
  WHERE google_drive_import_folder_id IS NOT NULL;
