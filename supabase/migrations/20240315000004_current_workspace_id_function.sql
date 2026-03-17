-- Returns the workspace_id for the requesting user (coach or client). T1 §3

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.workspace_id', true)::UUID,
    (SELECT c.workspace_id FROM public.coaches c WHERE c.user_id = auth.uid() LIMIT 1),
    (SELECT cl.workspace_id FROM public.clients cl
     JOIN public.profiles p ON p.id = auth.uid()
     WHERE cl.email = p.email AND cl.workspace_id IS NOT NULL
     LIMIT 1)
  );
$$;
