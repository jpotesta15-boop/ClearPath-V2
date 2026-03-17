-- Drop existing RLS policies on workspace-scoped tables and create workspace-based policies (T1 §5).
-- Tables: profiles, clients, programs, program_assignments, program_lessons, videos, video_assignments,
-- video_completions, availability_slots, sessions, session_products, session_requests, client_time_requests,
-- payments, messages, coach_daily_messages, coach_message_templates, coach_broadcasts, coach_broadcast_recipients,
-- activity_log, coach_brand_settings, coach_email_settings, coach_domains, coach_dashboard_layouts,
-- coach_client_experience, coach_profiles, coach_social_links

-- Ensure RLS is enabled on all workspace-scoped tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_time_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_daily_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_client_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_social_links ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
  tables TEXT[] := ARRAY[
    'profiles', 'clients', 'programs', 'program_assignments', 'program_lessons', 'videos', 'video_assignments',
    'video_completions', 'availability_slots', 'sessions', 'session_products', 'session_requests', 'client_time_requests',
    'payments', 'messages', 'coach_daily_messages', 'coach_message_templates', 'coach_broadcasts', 'coach_broadcast_recipients',
    'activity_log', 'coach_brand_settings', 'coach_email_settings', 'coach_domains', 'coach_dashboard_layouts',
    'coach_client_experience', 'coach_profiles', 'coach_social_links'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ---------- profiles: own row always; others in same workspace ----------
CREATE POLICY "profiles_select_workspace"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (workspace_id IS NOT NULL AND workspace_id = current_workspace_id())
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ---------- clients: coaches see all in workspace; clients see only own row ----------
CREATE POLICY "clients_select_workspace"
  ON public.clients FOR SELECT
  USING (
    workspace_id = current_workspace_id()
    AND (
      email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.workspace_id = clients.workspace_id)
    )
  );

CREATE POLICY "clients_insert_workspace"
  ON public.clients FOR INSERT
  WITH CHECK (workspace_id = current_workspace_id());

CREATE POLICY "clients_update_workspace"
  ON public.clients FOR UPDATE
  USING (
    workspace_id = current_workspace_id()
    AND (
      EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.workspace_id = clients.workspace_id)
      OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "clients_delete_workspace"
  ON public.clients FOR DELETE
  USING (workspace_id = current_workspace_id());

-- ---------- programs ----------
CREATE POLICY "programs_select_workspace" ON public.programs FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "programs_insert_workspace" ON public.programs FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "programs_update_workspace" ON public.programs FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "programs_delete_workspace" ON public.programs FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- program_assignments ----------
CREATE POLICY "program_assignments_select_workspace" ON public.program_assignments FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "program_assignments_insert_workspace" ON public.program_assignments FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "program_assignments_update_workspace" ON public.program_assignments FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "program_assignments_delete_workspace" ON public.program_assignments FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- program_lessons ----------
CREATE POLICY "program_lessons_select_workspace" ON public.program_lessons FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "program_lessons_insert_workspace" ON public.program_lessons FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "program_lessons_update_workspace" ON public.program_lessons FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "program_lessons_delete_workspace" ON public.program_lessons FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- videos ----------
CREATE POLICY "videos_select_workspace" ON public.videos FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "videos_insert_workspace" ON public.videos FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "videos_update_workspace" ON public.videos FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "videos_delete_workspace" ON public.videos FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- video_assignments ----------
CREATE POLICY "video_assignments_select_workspace" ON public.video_assignments FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "video_assignments_insert_workspace" ON public.video_assignments FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "video_assignments_update_workspace" ON public.video_assignments FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "video_assignments_delete_workspace" ON public.video_assignments FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- video_completions ----------
CREATE POLICY "video_completions_select_workspace" ON public.video_completions FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "video_completions_insert_workspace" ON public.video_completions FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "video_completions_update_workspace" ON public.video_completions FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "video_completions_delete_workspace" ON public.video_completions FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- availability_slots ----------
CREATE POLICY "availability_slots_select_workspace" ON public.availability_slots FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "availability_slots_insert_workspace" ON public.availability_slots FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "availability_slots_update_workspace" ON public.availability_slots FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "availability_slots_delete_workspace" ON public.availability_slots FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- sessions ----------
CREATE POLICY "sessions_select_workspace" ON public.sessions FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "sessions_insert_workspace" ON public.sessions FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "sessions_update_workspace" ON public.sessions FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "sessions_delete_workspace" ON public.sessions FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- session_products ----------
CREATE POLICY "session_products_select_workspace" ON public.session_products FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "session_products_insert_workspace" ON public.session_products FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "session_products_update_workspace" ON public.session_products FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "session_products_delete_workspace" ON public.session_products FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- session_requests ----------
CREATE POLICY "session_requests_select_workspace" ON public.session_requests FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "session_requests_insert_workspace" ON public.session_requests FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "session_requests_update_workspace" ON public.session_requests FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "session_requests_delete_workspace" ON public.session_requests FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- client_time_requests ----------
CREATE POLICY "client_time_requests_select_workspace" ON public.client_time_requests FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "client_time_requests_insert_workspace" ON public.client_time_requests FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "client_time_requests_update_workspace" ON public.client_time_requests FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "client_time_requests_delete_workspace" ON public.client_time_requests FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- payments ----------
CREATE POLICY "payments_select_workspace" ON public.payments FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "payments_insert_workspace" ON public.payments FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "payments_update_workspace" ON public.payments FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "payments_delete_workspace" ON public.payments FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- messages ----------
CREATE POLICY "messages_select_workspace" ON public.messages FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "messages_insert_workspace" ON public.messages FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "messages_update_workspace" ON public.messages FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "messages_delete_workspace" ON public.messages FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_daily_messages ----------
CREATE POLICY "coach_daily_messages_select_workspace" ON public.coach_daily_messages FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_daily_messages_insert_workspace" ON public.coach_daily_messages FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_daily_messages_update_workspace" ON public.coach_daily_messages FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_daily_messages_delete_workspace" ON public.coach_daily_messages FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_message_templates ----------
CREATE POLICY "coach_message_templates_select_workspace" ON public.coach_message_templates FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_message_templates_insert_workspace" ON public.coach_message_templates FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_message_templates_update_workspace" ON public.coach_message_templates FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_message_templates_delete_workspace" ON public.coach_message_templates FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_broadcasts ----------
CREATE POLICY "coach_broadcasts_select_workspace" ON public.coach_broadcasts FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_broadcasts_insert_workspace" ON public.coach_broadcasts FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_broadcasts_update_workspace" ON public.coach_broadcasts FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_broadcasts_delete_workspace" ON public.coach_broadcasts FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_broadcast_recipients ----------
CREATE POLICY "coach_broadcast_recipients_select_workspace" ON public.coach_broadcast_recipients FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_broadcast_recipients_insert_workspace" ON public.coach_broadcast_recipients FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_broadcast_recipients_update_workspace" ON public.coach_broadcast_recipients FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_broadcast_recipients_delete_workspace" ON public.coach_broadcast_recipients FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- activity_log ----------
CREATE POLICY "activity_log_select_workspace" ON public.activity_log FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "activity_log_insert_workspace" ON public.activity_log FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "activity_log_update_workspace" ON public.activity_log FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "activity_log_delete_workspace" ON public.activity_log FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_brand_settings ----------
CREATE POLICY "coach_brand_settings_select_workspace" ON public.coach_brand_settings FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_brand_settings_insert_workspace" ON public.coach_brand_settings FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_brand_settings_update_workspace" ON public.coach_brand_settings FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_brand_settings_delete_workspace" ON public.coach_brand_settings FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_email_settings ----------
CREATE POLICY "coach_email_settings_select_workspace" ON public.coach_email_settings FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_email_settings_insert_workspace" ON public.coach_email_settings FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_email_settings_update_workspace" ON public.coach_email_settings FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_email_settings_delete_workspace" ON public.coach_email_settings FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_domains ----------
CREATE POLICY "coach_domains_select_workspace" ON public.coach_domains FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_domains_insert_workspace" ON public.coach_domains FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_domains_update_workspace" ON public.coach_domains FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_domains_delete_workspace" ON public.coach_domains FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_dashboard_layouts ----------
CREATE POLICY "coach_dashboard_layouts_select_workspace" ON public.coach_dashboard_layouts FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_dashboard_layouts_insert_workspace" ON public.coach_dashboard_layouts FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_dashboard_layouts_update_workspace" ON public.coach_dashboard_layouts FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_dashboard_layouts_delete_workspace" ON public.coach_dashboard_layouts FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_client_experience ----------
CREATE POLICY "coach_client_experience_select_workspace" ON public.coach_client_experience FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_client_experience_insert_workspace" ON public.coach_client_experience FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_client_experience_update_workspace" ON public.coach_client_experience FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_client_experience_delete_workspace" ON public.coach_client_experience FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_profiles ----------
CREATE POLICY "coach_profiles_select_workspace" ON public.coach_profiles FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_profiles_insert_workspace" ON public.coach_profiles FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_profiles_update_workspace" ON public.coach_profiles FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_profiles_delete_workspace" ON public.coach_profiles FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- coach_social_links ----------
CREATE POLICY "coach_social_links_select_workspace" ON public.coach_social_links FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_social_links_insert_workspace" ON public.coach_social_links FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "coach_social_links_update_workspace" ON public.coach_social_links FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "coach_social_links_delete_workspace" ON public.coach_social_links FOR DELETE USING (workspace_id = current_workspace_id());
