-- Drop legacy tenant columns now that workspace_id and RLS are in place (T1 §8 step 6).
-- Run this after application code has been updated to use workspace_id instead of tenant_id / client_id (TEXT).

-- profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS tenant_id;

-- clients (TEXT tenant column only; keep coach_id and other columns)
ALTER TABLE public.clients DROP COLUMN IF EXISTS client_id;

-- programs (TEXT tenant column)
ALTER TABLE public.programs DROP COLUMN IF EXISTS client_id;

-- videos (TEXT tenant column)
ALTER TABLE public.videos DROP COLUMN IF EXISTS client_id;

-- availability_slots (TEXT tenant column)
ALTER TABLE public.availability_slots DROP COLUMN IF EXISTS client_id;

-- sessions
ALTER TABLE public.sessions DROP COLUMN IF EXISTS tenant_id;

-- session_products (TEXT tenant column; NOT NULL in schema - drop after backfill)
ALTER TABLE public.session_products DROP COLUMN IF EXISTS client_id;

-- session_requests
ALTER TABLE public.session_requests DROP COLUMN IF EXISTS tenant_id;

-- client_time_requests
ALTER TABLE public.client_time_requests DROP COLUMN IF EXISTS tenant_id;

-- payments (TEXT tenant column)
ALTER TABLE public.payments DROP COLUMN IF EXISTS client_id;

-- messages (TEXT tenant column)
ALTER TABLE public.messages DROP COLUMN IF EXISTS client_id;

-- coach_daily_messages (TEXT tenant column)
ALTER TABLE public.coach_daily_messages DROP COLUMN IF EXISTS client_id;

-- coach_message_templates
ALTER TABLE public.coach_message_templates DROP COLUMN IF EXISTS tenant_id;

-- coach_broadcasts
ALTER TABLE public.coach_broadcasts DROP COLUMN IF EXISTS tenant_id;

-- coach_broadcast_recipients
ALTER TABLE public.coach_broadcast_recipients DROP COLUMN IF EXISTS tenant_id;

-- activity_log (TEXT tenant column)
ALTER TABLE public.activity_log DROP COLUMN IF EXISTS client_id;

-- coach_* tables with tenant_id
ALTER TABLE public.coach_brand_settings DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.coach_email_settings DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.coach_domains DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.coach_dashboard_layouts DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.coach_client_experience DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.coach_profiles DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.coach_social_links DROP COLUMN IF EXISTS tenant_id;

-- workspaces: remove backfill helper
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS legacy_tenant_id;
