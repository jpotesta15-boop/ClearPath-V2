-- Base schema required before 20240315000003 (add_workspace_id_to_all_tables).
-- Creates profiles and all tables that migration 3 alters. Uses legacy tenant_id/client_id
-- so migration 3's backfill can run. Run after 000001 (workspaces) and 000002 (coaches).

-- ---------- profiles (extends auth.users) ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('coach', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id TEXT
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
  END IF;
END $$;

-- ---------- clients ----------
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_clients_coach ON public.clients(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_clients_client_id ON public.clients(client_id); END IF; END $$;

-- ---------- programs ----------
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id TEXT
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_programs_client_id ON public.programs(client_id); END IF; END $$;

-- ---------- program_assignments ----------
CREATE TABLE IF NOT EXISTS public.program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_program_assignments_program ON public.program_assignments(program_id);

-- ---------- program_lessons ----------
CREATE TABLE IF NOT EXISTS public.program_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  video_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lesson_type TEXT NOT NULL DEFAULT 'video' CHECK (lesson_type IN ('video', 'link', 'note', 'image')),
  title TEXT,
  url TEXT,
  content TEXT
);
CREATE INDEX IF NOT EXISTS idx_program_lessons_program ON public.program_lessons(program_id);

-- ---------- videos ----------
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  thumbnail_url TEXT,
  client_id TEXT
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_videos_client_id ON public.videos(client_id); END IF; END $$;

-- ---------- video_assignments ----------
CREATE TABLE IF NOT EXISTS public.video_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(video_id, client_id)
);

-- ---------- video_completions ----------
CREATE TABLE IF NOT EXISTS public.video_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_completions_client ON public.video_completions(client_id);
CREATE INDEX IF NOT EXISTS idx_video_completions_video ON public.video_completions(video_id);

-- ---------- availability_slots ----------
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_group_session BOOLEAN NOT NULL DEFAULT FALSE,
  max_participants INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id TEXT,
  session_product_id UUID,
  label TEXT
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'availability_slots' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_availability_slots_client_id ON public.availability_slots(client_id); END IF; END $$;

-- ---------- session_products ----------
CREATE TABLE IF NOT EXISTS public.session_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  price_cents INTEGER NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_products_coach ON public.session_products(coach_id);

-- ---------- session_requests ----------
CREATE TABLE IF NOT EXISTS public.session_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  session_product_id UUID REFERENCES public.session_products(id) ON DELETE SET NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'payment_pending', 'paid', 'availability_submitted', 'scheduled', 'cancelled')),
  amount_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  availability_preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  availability_slot_id UUID
);
CREATE INDEX IF NOT EXISTS idx_session_requests_coach ON public.session_requests(coach_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_client ON public.session_requests(client_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_requests' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_session_requests_tenant ON public.session_requests(tenant_id); END IF; END $$;

-- ---------- sessions ----------
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  availability_slot_id UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  tenant_id TEXT,
  session_request_id UUID REFERENCES public.session_requests(id) ON DELETE SET NULL,
  session_product_id UUID REFERENCES public.session_products(id) ON DELETE SET NULL,
  amount_cents INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_coach ON public.sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON public.sessions(client_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_sessions_tenant_id ON public.sessions(tenant_id); END IF; END $$;

-- ---------- client_time_requests ----------
CREATE TABLE IF NOT EXISTS public.client_time_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  preferred_times TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'offered', 'confirmed', 'declined')),
  session_request_id UUID REFERENCES public.session_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_time_requests_coach ON public.client_time_requests(coach_id);
CREATE INDEX IF NOT EXISTS idx_client_time_requests_client ON public.client_time_requests(client_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_time_requests' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_client_time_requests_tenant ON public.client_time_requests(tenant_id); END IF; END $$;

-- ---------- payments ----------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  session_request_id UUID REFERENCES public.session_requests(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'refunded', 'cancelled', 'recorded_manual')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'zelle', 'paypal', 'cashapp', 'other')),
  stripe_payment_intent_id TEXT,
  payer_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_coach ON public.payments(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id); END IF; END $$;

-- ---------- messages ----------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id); END IF; END $$;

-- ---------- coach_daily_messages ----------
CREATE TABLE IF NOT EXISTS public.coach_daily_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  effective_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_daily_messages' AND column_name = 'client_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_daily_messages_coach_client ON public.coach_daily_messages(coach_id, client_id, effective_at); END IF; END $$;

-- ---------- coach_message_templates ----------
CREATE TABLE IF NOT EXISTS public.coach_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  body_markdown TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'in_app')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_message_templates_coach ON public.coach_message_templates(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_message_templates' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_message_templates_tenant ON public.coach_message_templates(tenant_id); END IF; END $$;

-- ---------- coach_broadcasts ----------
CREATE TABLE IF NOT EXISTS public.coach_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  template_id UUID REFERENCES public.coach_message_templates(id) ON DELETE SET NULL,
  subject TEXT,
  body_rendered TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'in_app')),
  segment_filter JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'canceled')),
  send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_broadcasts_coach ON public.coach_broadcasts(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_broadcasts' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_broadcasts_tenant ON public.coach_broadcasts(tenant_id); END IF; END $$;

-- ---------- coach_broadcast_recipients ----------
CREATE TABLE IF NOT EXISTS public.coach_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.coach_broadcasts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'queued', 'sent', 'bounced', 'failed', 'unsubscribed')),
  delivery_metadata JSONB,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coach_broadcast_recipients_broadcast ON public.coach_broadcast_recipients(broadcast_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_broadcast_recipients' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_broadcast_recipients_tenant ON public.coach_broadcast_recipients(tenant_id); END IF; END $$;

-- ---------- activity_log ----------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id TEXT
);

-- ---------- coach_brand_settings ----------
CREATE TABLE IF NOT EXISTS public.coach_brand_settings (
  coach_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  logo_url TEXT,
  app_icon_url TEXT,
  brand_image_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  theme_mode TEXT NOT NULL DEFAULT 'system' CHECK (theme_mode IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  brand_name TEXT,
  favicon_url TEXT,
  background_color TEXT,
  white_label BOOLEAN NOT NULL DEFAULT FALSE
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_brand_settings' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_brand_settings_tenant ON public.coach_brand_settings(tenant_id); END IF; END $$;

-- ---------- coach_email_settings ----------
CREATE TABLE IF NOT EXISTS public.coach_email_settings (
  coach_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  email_logo_url TEXT,
  footer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_email_settings' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_email_settings_tenant ON public.coach_email_settings(tenant_id); END IF; END $$;

-- ---------- coach_domains ----------
CREATE TABLE IF NOT EXISTS public.coach_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verifying', 'active', 'error', 'disabled')),
  verification_token TEXT NOT NULL,
  verification_method TEXT NOT NULL DEFAULT 'dns_txt' CHECK (verification_method IN ('dns_txt', 'http_file')),
  last_checked_at TIMESTAMPTZ,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ssl_status TEXT NOT NULL DEFAULT 'not_started' CHECK (ssl_status IN ('not_started', 'provisioning', 'issued', 'failed')),
  domain_verified BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_coach_domains_coach ON public.coach_domains(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_domains' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_domains_tenant ON public.coach_domains(tenant_id); END IF; END $$;

-- ---------- coach_dashboard_layouts ----------
CREATE TABLE IF NOT EXISTS public.coach_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'default',
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  layout_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_dashboard_layouts_coach ON public.coach_dashboard_layouts(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_dashboard_layouts' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_dashboard_layouts_tenant ON public.coach_dashboard_layouts(tenant_id); END IF; END $$;

-- ---------- coach_client_experience ----------
CREATE TABLE IF NOT EXISTS public.coach_client_experience (
  coach_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  welcome_title TEXT,
  welcome_body TEXT,
  hero_image_url TEXT,
  intro_video_source TEXT CHECK (intro_video_source IN ('google_drive', 'youtube', 'upload')),
  intro_video_url TEXT,
  intro_video_metadata JSONB,
  show_welcome_block BOOLEAN NOT NULL DEFAULT TRUE,
  portal_theme_overrides JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  portal_nav_enabled JSONB NOT NULL DEFAULT '[]',
  portal_booking_instructions TEXT,
  terminology JSONB NOT NULL DEFAULT '{}'
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_client_experience' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_client_experience_tenant ON public.coach_client_experience(tenant_id); END IF; END $$;

-- ---------- coach_profiles ----------
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  coach_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  specialties TEXT[],
  profile_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  show_social_links BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_profiles' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_profiles_tenant ON public.coach_profiles(tenant_id); END IF; END $$;

-- ---------- coach_social_links ----------
CREATE TABLE IF NOT EXISTS public.coach_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('website', 'instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x', 'other')),
  label TEXT,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_coach_social_links_coach ON public.coach_social_links(coach_id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coach_social_links' AND column_name = 'tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_coach_social_links_tenant ON public.coach_social_links(tenant_id); END IF; END $$;
