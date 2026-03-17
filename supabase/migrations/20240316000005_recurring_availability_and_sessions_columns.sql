-- Session 9: recurring_availability table + sessions end_time/duration_minutes

-- ---------- recurring_availability ----------
CREATE TABLE IF NOT EXISTS public.recurring_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT,
  session_product_id UUID REFERENCES public.session_products(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_availability_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_recurring_availability_workspace ON public.recurring_availability(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_availability_coach ON public.recurring_availability(coach_id);
CREATE INDEX IF NOT EXISTS idx_recurring_availability_day ON public.recurring_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_recurring_availability_workspace_coach_day ON public.recurring_availability(workspace_id, coach_id, day_of_week);

ALTER TABLE public.recurring_availability ENABLE ROW LEVEL SECURITY;

-- RLS: all operations scoped to current_workspace_id() (coach in workspace)
DROP POLICY IF EXISTS "recurring_availability_select_workspace" ON public.recurring_availability;
CREATE POLICY "recurring_availability_select_workspace"
  ON public.recurring_availability FOR SELECT
  USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "recurring_availability_insert_workspace" ON public.recurring_availability;
CREATE POLICY "recurring_availability_insert_workspace"
  ON public.recurring_availability FOR INSERT
  WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "recurring_availability_update_workspace" ON public.recurring_availability;
CREATE POLICY "recurring_availability_update_workspace"
  ON public.recurring_availability FOR UPDATE
  USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "recurring_availability_delete_workspace" ON public.recurring_availability;
CREATE POLICY "recurring_availability_delete_workspace"
  ON public.recurring_availability FOR DELETE
  USING (workspace_id = current_workspace_id());

-- ---------- sessions: add end_time and duration_minutes if not present ----------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
