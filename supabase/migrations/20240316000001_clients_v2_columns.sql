-- Session 5: clients table V2 — add first_name, last_name, goals, status, profile_photo_url.
-- If clients table does not exist, create it with full schema. Otherwise add missing columns.
-- RLS and index on workspace_id are already in 20240315000005 and 20240315000003.

-- 1) Create clients table only if it does not exist
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  goals TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Add missing columns when table already existed (e.g. from legacy schema)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS goals TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure status constraint and NOT NULL/default (idempotent)
DO $$
BEGIN
  -- Add check constraint only if no check on status exists yet
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attname = 'status'
    WHERE c.conrelid = 'public.clients'::regclass AND c.contype = 'c'
  ) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_status_check
      CHECK (status IN ('active', 'paused', 'completed'));
  END IF;
  UPDATE public.clients SET status = 'active' WHERE status IS NULL;
  ALTER TABLE public.clients ALTER COLUMN status SET DEFAULT 'active';
  ALTER TABLE public.clients ALTER COLUMN status SET NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- 3) Index on workspace_id (already created in 20240315000003; ensure it exists)
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);

-- 4) RLS: policies already created in 20240315000005_rls_workspace_policies.sql
-- (clients_select_workspace, clients_insert_workspace, clients_update_workspace, clients_delete_workspace)
-- using current_workspace_id(). No change needed unless table was just created here.
-- Ensure RLS is enabled.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
