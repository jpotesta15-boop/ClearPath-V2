-- Enable Realtime for videos table (Session 13 — live status updates on coach videos page)
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
