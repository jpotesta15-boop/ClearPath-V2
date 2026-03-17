-- Coaches table: links auth.users to workspaces (T1 §2)
-- Idempotent: safe to re-run if table already exists.

CREATE TABLE IF NOT EXISTS public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'team_member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_coaches_user ON public.coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_coaches_workspace ON public.coaches(workspace_id);

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see their own coach row(s); insert/update/delete by owner or service role
DROP POLICY IF EXISTS "coaches_select_own" ON public.coaches;
CREATE POLICY "coaches_select_own"
  ON public.coaches FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coaches_insert_own" ON public.coaches;
CREATE POLICY "coaches_insert_own"
  ON public.coaches FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "coaches_update_own" ON public.coaches;
CREATE POLICY "coaches_update_own"
  ON public.coaches FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coaches_delete_own" ON public.coaches;
CREATE POLICY "coaches_delete_own"
  ON public.coaches FOR DELETE
  USING (user_id = auth.uid());
