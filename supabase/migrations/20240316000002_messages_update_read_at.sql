-- Allow message recipient to UPDATE their messages (e.g. set read_at).
-- Session 6 / 02-database-schema §12.2, 11-auth-permissions §6.15.

CREATE POLICY "messages_update_read_at" ON public.messages
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
