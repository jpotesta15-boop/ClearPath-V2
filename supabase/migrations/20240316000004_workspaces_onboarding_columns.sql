-- Workspaces: onboarding and coach context columns (M2-onboarding-flow, Session 7)
-- Add if not exist for idempotency.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS coaching_types TEXT[];

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS current_client_count INTEGER;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
