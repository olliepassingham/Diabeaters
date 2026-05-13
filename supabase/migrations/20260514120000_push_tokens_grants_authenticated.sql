-- Client upserts to public.push_tokens use the authenticated role. Some projects
-- only had DELETE granted (see 20260504200000_push_tokens_delete_self.sql), which
-- breaks INSERT/UPDATE and leaves no row after registration.
--
-- Idempotent: only runs if public.push_tokens exists.

DO $$
BEGIN
  IF to_regclass('public.push_tokens') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated';
END $$;
