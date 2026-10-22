-- Lightweight, privacy-first route analytics: which screens signed-in users visit.
-- Paths only (no query strings, no clinical data). Read via SQL Editor (project owner);
-- app users can insert their own rows and read nothing back.

CREATE TABLE IF NOT EXISTS public.app_route_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  route text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_route_views_created_at_idx
  ON public.app_route_views (created_at DESC);

CREATE INDEX IF NOT EXISTS app_route_views_route_created_idx
  ON public.app_route_views (route, created_at DESC);

CREATE INDEX IF NOT EXISTS app_route_views_user_created_idx
  ON public.app_route_views (user_id, created_at DESC);

COMMENT ON TABLE public.app_route_views IS
  'One row per signed-in screen view. Route is normalised client-side (dynamic ids collapsed). Owner reads via SQL Editor.';

ALTER TABLE public.app_route_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_route_views_insert_own ON public.app_route_views;
CREATE POLICY app_route_views_insert_own
  ON public.app_route_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Deliberately no SELECT/UPDATE/DELETE policies for authenticated:
-- clients write-only; reads happen as project owner in the SQL Editor.

GRANT INSERT ON public.app_route_views TO authenticated;
