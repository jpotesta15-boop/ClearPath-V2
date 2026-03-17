-- Billing: subscriptions table (one per workspace) + workspaces.stripe_customer_id if missing
-- Session 10 — T2 billing. RLS: workspace owner SELECT only; INSERT/UPDATE via service role (webhooks).

-- Add stripe_customer_id to workspaces if not present (already exists in 20240315000001; safe no-op)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN stripe_customer_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  END IF;
END $$;

-- Subscriptions: one row per workspace; written by Stripe webhook (service role)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'scale')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id)
);

CREATE INDEX idx_subscriptions_workspace_id ON public.subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: workspace owner (via coaches) can SELECT their subscription only
DROP POLICY IF EXISTS "subscriptions_select_workspace_owner" ON public.subscriptions;
CREATE POLICY "subscriptions_select_workspace_owner"
  ON public.subscriptions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.coaches WHERE user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE for anon/authenticated; webhook uses service role

-- Idempotency for Stripe webhooks (service role only)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
