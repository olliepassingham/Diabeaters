-- Public follower/following counts without exposing the full follow graph via RLS.
-- user_follows SELECT is limited to rows involving auth.uid(); count queries from the
-- client therefore returned 0 for other users. This RPC returns aggregates only.
--
-- Implemented as LANGUAGE sql (not plpgsql) so PL/pgSQL variable substitution cannot
-- mis-resolve names like v_is_public vs is_public (which caused: relation "v_is_public" does not exist).

CREATE OR REPLACE FUNCTION public.public_follow_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gate AS (
    SELECT
      p_user_id AS uid,
      EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_user_id) AS has_profile,
      (auth.uid() IS NOT NULL AND auth.uid() = p_user_id) AS is_self,
      COALESCE(
        (SELECT pr.is_public FROM public.profiles pr WHERE pr.id = p_user_id),
        true
      ) AS profile_public
  )
  SELECT CASE
    WHEN g.uid IS NULL THEN jsonb_build_object('followers', 0, 'following', 0)
    WHEN NOT g.has_profile THEN jsonb_build_object('followers', 0, 'following', 0)
    WHEN g.is_self OR g.profile_public IS TRUE THEN jsonb_build_object(
      'followers', (SELECT count(*)::bigint FROM public.user_follows WHERE followee_id = g.uid),
      'following', (SELECT count(*)::bigint FROM public.user_follows WHERE follower_id = g.uid)
    )
    ELSE jsonb_build_object('followers', 0, 'following', 0)
  END
  FROM gate g;
$$;

COMMENT ON FUNCTION public.public_follow_counts(uuid) IS 'Returns follower/following counts for p_user_id when the profile is public or the viewer is that user; SECURITY DEFINER; no row-level follow graph exposure.';

REVOKE ALL ON FUNCTION public.public_follow_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_follow_counts(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_follow_counts(uuid) TO authenticated;
