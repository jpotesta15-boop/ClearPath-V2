-- Session 11: session packages and invoices (manual payments + Stripe placeholder).
-- Tables: session_packages, session_invoices. Optional: message_type on messages for invoice cards.

-- ---------- session_packages ----------
CREATE TABLE IF NOT EXISTS public.session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  session_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_packages_workspace ON public.session_packages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_coach ON public.session_packages(coach_id);

ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_packages_select_workspace" ON public.session_packages
  FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "session_packages_insert_workspace" ON public.session_packages
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "session_packages_update_workspace" ON public.session_packages
  FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "session_packages_delete_workspace" ON public.session_packages
  FOR DELETE USING (workspace_id = current_workspace_id());

-- ---------- session_invoices ----------
CREATE TABLE IF NOT EXISTS public.session_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.session_packages(id) ON DELETE RESTRICT,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'zelle', 'venmo', 'cashapp', 'paypal', 'bank_transfer', 'stripe', 'other')),
  payment_method_note TEXT,
  payment_reference TEXT,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_invoices_workspace ON public.session_invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_invoices_client ON public.session_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_session_invoices_status ON public.session_invoices(status);
CREATE INDEX IF NOT EXISTS idx_session_invoices_created ON public.session_invoices(created_at DESC);

ALTER TABLE public.session_invoices ENABLE ROW LEVEL SECURITY;

-- Coach: full access in workspace
CREATE POLICY "session_invoices_select_workspace" ON public.session_invoices
  FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY "session_invoices_insert_workspace" ON public.session_invoices
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY "session_invoices_update_workspace" ON public.session_invoices
  FOR UPDATE USING (workspace_id = current_workspace_id());
CREATE POLICY "session_invoices_delete_workspace" ON public.session_invoices
  FOR DELETE USING (workspace_id = current_workspace_id());

-- Client: can SELECT their own invoices only
CREATE POLICY "session_invoices_select_client_own" ON public.session_invoices
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      AND workspace_id = current_workspace_id()
    )
  );

-- ---------- messages: add message_type for invoice cards ----------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

COMMENT ON COLUMN public.messages.message_type IS 'text | invoice — when invoice, content is JSON for invoice card';
