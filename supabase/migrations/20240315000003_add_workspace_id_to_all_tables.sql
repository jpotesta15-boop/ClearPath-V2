-- Add workspace_id to all tenant-scoped tables (T1 §4). Columns nullable for backfill.
-- Then seed workspaces/coaches from existing profile data and backfill.

-- 1) Add workspace_id column to every table that needs it

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.program_assignments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.program_lessons ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.video_assignments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.video_completions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.availability_slots ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.session_products ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.session_requests ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.client_time_requests ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_daily_messages ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_message_templates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_broadcasts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_broadcast_recipients ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.coach_brand_settings ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_email_settings ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_domains ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_dashboard_layouts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_client_experience ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.coach_social_links ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 2) Seed workspaces and 3) 4) backfill only when legacy_tenant_id still exists (skip if already migrated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'legacy_tenant_id') THEN
    RETURN;
  END IF;

  INSERT INTO public.workspaces (name, owner_id, legacy_tenant_id)
  SELECT COALESCE(t.tenant_id, 'default'),
    (SELECT p.id FROM public.profiles p WHERE p.role = 'coach' AND (p.tenant_id IS NOT DISTINCT FROM t.tenant_id) LIMIT 1),
    COALESCE(t.tenant_id, 'default')
  FROM (SELECT DISTINCT tenant_id FROM public.profiles WHERE role = 'coach' AND tenant_id IS NOT NULL) t
  ON CONFLICT (legacy_tenant_id) DO NOTHING;

  INSERT INTO public.coaches (user_id, workspace_id, role)
  SELECT p.id, w.id, 'owner'
  FROM public.profiles p
  JOIN public.workspaces w ON w.legacy_tenant_id = COALESCE(p.tenant_id, 'default')
  WHERE p.role = 'coach'
  ON CONFLICT (user_id, workspace_id) DO NOTHING;
END $$;

-- 4) Backfill workspace_id from legacy tenant columns (only when legacy columns exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'legacy_tenant_id') THEN
    RETURN;
  END IF;

  UPDATE public.profiles p
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(p.tenant_id, 'default')
  AND p.workspace_id IS NULL;

UPDATE public.clients c
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(c.client_id, 'default')
  AND c.workspace_id IS NULL;

UPDATE public.programs pr
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(pr.client_id, 'default')
  AND pr.workspace_id IS NULL;

UPDATE public.program_assignments pa
SET workspace_id = p.workspace_id
FROM public.programs p
WHERE p.id = pa.program_id AND pa.workspace_id IS NULL;

UPDATE public.program_lessons pl
SET workspace_id = p.workspace_id
FROM public.programs p
WHERE p.id = pl.program_id AND pl.workspace_id IS NULL;

UPDATE public.videos v
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(v.client_id, 'default')
  AND v.workspace_id IS NULL;

UPDATE public.video_assignments va
SET workspace_id = v.workspace_id
FROM public.videos v
WHERE v.id = va.video_id AND va.workspace_id IS NULL;

UPDATE public.video_completions vc
SET workspace_id = c.workspace_id
FROM public.clients c
WHERE c.id = vc.client_id AND vc.workspace_id IS NULL;

UPDATE public.availability_slots a
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(a.client_id, 'default')
  AND a.workspace_id IS NULL;

UPDATE public.sessions s
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(s.tenant_id, 'default')
  AND s.workspace_id IS NULL;

UPDATE public.session_products sp
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(sp.client_id, 'default')
  AND sp.workspace_id IS NULL;

UPDATE public.session_requests sr
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(sr.tenant_id, 'default')
  AND sr.workspace_id IS NULL;

UPDATE public.client_time_requests ctr
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(ctr.tenant_id, 'default')
  AND ctr.workspace_id IS NULL;

UPDATE public.payments pay
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(pay.client_id, 'default')
  AND pay.workspace_id IS NULL;

UPDATE public.messages m
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(m.client_id, 'default')
  AND m.workspace_id IS NULL;

UPDATE public.coach_daily_messages cdm
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cdm.client_id, 'default')
  AND cdm.workspace_id IS NULL;

UPDATE public.coach_message_templates cmt
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cmt.tenant_id, 'default')
  AND cmt.workspace_id IS NULL;

UPDATE public.coach_broadcasts cb
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cb.tenant_id, 'default')
  AND cb.workspace_id IS NULL;

UPDATE public.coach_broadcast_recipients cbr
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cbr.tenant_id, 'default')
  AND cbr.workspace_id IS NULL;

UPDATE public.activity_log al
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(al.client_id, 'default')
  AND al.workspace_id IS NULL;

UPDATE public.coach_brand_settings cbs
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cbs.tenant_id, 'default')
  AND cbs.workspace_id IS NULL;

UPDATE public.coach_email_settings ces
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(ces.tenant_id, 'default')
  AND ces.workspace_id IS NULL;

UPDATE public.coach_domains cd
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cd.tenant_id, 'default')
  AND cd.workspace_id IS NULL;

UPDATE public.coach_dashboard_layouts cdl
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cdl.tenant_id, 'default')
  AND cdl.workspace_id IS NULL;

UPDATE public.coach_client_experience cce
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cce.tenant_id, 'default')
  AND cce.workspace_id IS NULL;

UPDATE public.coach_profiles cp
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.legacy_tenant_id = COALESCE(cp.tenant_id, 'default')
  AND cp.workspace_id IS NULL;

  UPDATE public.coach_social_links csl
  SET workspace_id = w.id
  FROM public.workspaces w
  WHERE w.legacy_tenant_id = COALESCE(csl.tenant_id, 'default')
    AND csl.workspace_id IS NULL;

END $$;

-- 5) Indexes on workspace_id for RLS and queries

CREATE INDEX IF NOT EXISTS idx_profiles_workspace ON public.profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_programs_workspace ON public.programs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_program_assignments_workspace ON public.program_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_program_lessons_workspace ON public.program_lessons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_workspace ON public.videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_video_assignments_workspace ON public.video_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_video_completions_workspace ON public.video_completions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_workspace ON public.availability_slots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON public.sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_products_workspace ON public.session_products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_workspace ON public.session_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_time_requests_workspace ON public.client_time_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payments_workspace ON public.payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_daily_messages_workspace ON public.coach_daily_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_message_templates_workspace ON public.coach_message_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_broadcasts_workspace ON public.coach_broadcasts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_broadcast_recipients_workspace ON public.coach_broadcast_recipients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_workspace ON public.activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_brand_settings_workspace ON public.coach_brand_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_email_settings_workspace ON public.coach_email_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_domains_workspace ON public.coach_domains(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_dashboard_layouts_workspace ON public.coach_dashboard_layouts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_experience_workspace ON public.coach_client_experience(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_profiles_workspace ON public.coach_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_coach_social_links_workspace ON public.coach_social_links(workspace_id);
