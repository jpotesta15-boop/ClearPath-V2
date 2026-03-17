-- Session 8: messages table — add client_id (UUID FK to clients), RLS for participant-based access, indexes.
-- Run after 20240316000002_messages_update_read_at.sql (UPDATE policy stays as-is).

-- 1) Add client_id (UUID) — one thread per client (coach ↔ client person).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Backfill: set client_id from the client party in the thread (one of sender/recipient is the client user).
UPDATE public.messages m
SET client_id = sub.client_id
FROM (
  SELECT DISTINCT ON (m2.id) m2.id AS msg_id, cl.id AS client_id
  FROM public.messages m2
  JOIN public.clients cl ON cl.workspace_id = m2.workspace_id
  JOIN public.profiles p ON p.email = cl.email AND (m2.sender_id = p.id OR m2.recipient_id = p.id)
  WHERE m2.client_id IS NULL
) sub
WHERE m.id = sub.msg_id;

-- 2) RLS: replace SELECT and INSERT with participant/workspace rules. UPDATE already in 20240316000002.
DROP POLICY IF EXISTS "messages_select_workspace" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert_workspace" ON public.messages;
CREATE POLICY "messages_insert_sender_workspace" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND workspace_id = current_workspace_id());

-- Keep messages_update_workspace or messages_update_read_at: Session 6 added messages_update_read_at.
-- Drop workspace UPDATE so only recipient can update (for read_at):
DROP POLICY IF EXISTS "messages_update_workspace" ON public.messages;

-- 3) Indexes for messages list and thread queries
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_created ON public.messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_desc ON public.messages(created_at DESC);
-- workspace_id index already exists from 20240315000003 (idx_messages_workspace)
