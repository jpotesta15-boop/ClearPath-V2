-- Session 12: Program builder — programs (V2), program_modules, program_content, client_programs, program_progress.
-- RLS: current_workspace_id() for coach; client sees own rows where specified.

-- ---------- programs: add V2 columns (table exists with name, workspace_id, coach_id) ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'name') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'title') THEN
      ALTER TABLE public.programs ADD COLUMN title TEXT;
      UPDATE public.programs SET title = COALESCE(name, 'Untitled');
      ALTER TABLE public.programs ALTER COLUMN title SET NOT NULL;
      ALTER TABLE public.programs ALTER COLUMN title SET DEFAULT 'Untitled';
      ALTER TABLE public.programs DROP COLUMN name;
    ELSE
      ALTER TABLE public.programs DROP COLUMN name;
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'title') THEN
    ALTER TABLE public.programs ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled';
  END IF;
END $$;

ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS total_modules INTEGER NOT NULL DEFAULT 0;
UPDATE public.programs SET status = 'draft' WHERE status IS NULL;
ALTER TABLE public.programs ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.programs ALTER COLUMN status SET DEFAULT 'draft';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_status_check') THEN
    ALTER TABLE public.programs ADD CONSTRAINT programs_status_check CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS total_modules INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_programs_workspace_status ON public.programs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_programs_coach ON public.programs(coach_id);

-- ---------- program_modules ----------
CREATE TABLE IF NOT EXISTS public.program_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_modules_program ON public.program_modules(program_id);
CREATE INDEX IF NOT EXISTS idx_program_modules_position ON public.program_modules(program_id, position);

ALTER TABLE public.program_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_modules_select_workspace" ON public.program_modules
  FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "program_modules_insert_workspace" ON public.program_modules
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "program_modules_update_workspace" ON public.program_modules
  FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "program_modules_delete_workspace" ON public.program_modules
  FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- program_content ----------
CREATE TABLE IF NOT EXISTS public.program_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'url', 'video', 'file')),
  title TEXT,
  body TEXT,
  url TEXT,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  file_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_content_module ON public.program_content(module_id);
CREATE INDEX IF NOT EXISTS idx_program_content_position ON public.program_content(module_id, position);

ALTER TABLE public.program_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_content_select_workspace" ON public.program_content
  FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "program_content_insert_workspace" ON public.program_content
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "program_content_update_workspace" ON public.program_content
  FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "program_content_delete_workspace" ON public.program_content
  FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- client_programs ----------
CREATE TABLE IF NOT EXISTS public.client_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_programs_workspace ON public.client_programs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_client ON public.client_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_program ON public.client_programs(program_id);

ALTER TABLE public.client_programs ENABLE ROW LEVEL SECURITY;

-- Coach: all ops via workspace
CREATE POLICY "client_programs_select_workspace" ON public.client_programs
  FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "client_programs_insert_workspace" ON public.client_programs
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "client_programs_update_workspace" ON public.client_programs
  FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "client_programs_delete_workspace" ON public.client_programs
  FOR DELETE USING (workspace_id = current_workspace_id());

-- Client: SELECT their own rows only
CREATE POLICY "client_programs_select_client_own" ON public.client_programs
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      AND workspace_id = current_workspace_id()
    )
  );

-- ---------- program_progress ----------
CREATE TABLE IF NOT EXISTS public.program_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_program_id UUID REFERENCES public.client_programs(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.program_modules(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_program_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_program_progress_client_program ON public.program_progress(client_program_id);
CREATE INDEX IF NOT EXISTS idx_program_progress_client ON public.program_progress(client_id);

ALTER TABLE public.program_progress ENABLE ROW LEVEL SECURITY;

-- Coach: SELECT via workspace
CREATE POLICY "program_progress_select_workspace" ON public.program_progress
  FOR SELECT USING (workspace_id = current_workspace_id());

-- Client: INSERT/UPDATE their own rows (for marking module complete)
CREATE POLICY "program_progress_insert_client_own" ON public.program_progress
  FOR INSERT WITH CHECK (
    workspace_id = current_workspace_id()
    AND client_id IN (
      SELECT id FROM public.clients
      WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      AND workspace_id = current_workspace_id()
    )
  );
CREATE POLICY "program_progress_update_client_own" ON public.program_progress
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      AND workspace_id = current_workspace_id()
    )
  );

-- Note: Create storage bucket "programs" in Supabase Dashboard (Storage) for file uploads
-- Path: programs/{workspace_id}/{module_id}/{filename}. Max 50MB; allow image/*, .pdf, .doc, .docx
