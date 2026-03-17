-- Multi-tenant foundation: workspaces table (T1-multi-tenant-schema §1)
-- Run before adding workspace_id to other tables.
-- Uses legacy_tenant_id for backfilling existing tenant data; drop in a later migration.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT,
  max_clients INTEGER NOT NULL DEFAULT 10,
  max_video_storage_gb INTEGER NOT NULL DEFAULT 5,
  legacy_tenant_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'legacy_tenant_id') THEN CREATE INDEX IF NOT EXISTS idx_workspaces_legacy_tenant ON public.workspaces(legacy_tenant_id) WHERE legacy_tenant_id IS NOT NULL; END IF; END $$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- RLS: only owner can see/update their workspace(s); insert allowed for self-owned workspace (signup path)
DROP POLICY IF EXISTS "workspaces_select_owner" ON public.workspaces;
CREATE POLICY "workspaces_select_owner"
  ON public.workspaces FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_update_owner" ON public.workspaces;
CREATE POLICY "workspaces_update_owner"
  ON public.workspaces FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_insert_owner" ON public.workspaces;
CREATE POLICY "workspaces_insert_owner"
  ON public.workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());
