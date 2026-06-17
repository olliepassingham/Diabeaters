-- Full follower/following lists for public community profiles (authenticated viewers).
-- user_follows RLS only exposes rows involving auth.uid(); these RPCs return the full
-- list for a public profile (or the viewer's own profile), excluding block relationships.

CREATE OR REPLACE FUNCTION public.list_public_profile_followers(
  p_user_id uuid,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gate AS (
    SELECT
      p_user_id AS uid,
      auth.uid() AS viewer_id,
      EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_user_id) AS has_profile,
      (auth.uid() IS NOT NULL AND auth.uid() = p_user_id) AS is_self,
      COALESCE(
        (SELECT pr.is_public FROM public.profiles pr WHERE pr.id = p_user_id),
        true
      ) AS profile_public
  ),
  lim AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)::integer AS n
  )
  SELECT uf.follower_id AS user_id
  FROM public.user_follows uf
  CROSS JOIN gate g
  CROSS JOIN lim l
  WHERE g.viewer_id IS NOT NULL
    AND g.has_profile
    AND (g.is_self OR g.profile_public IS TRUE)
    AND uf.followee_id = g.uid
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_blocks b
      WHERE (b.blocker_id = g.viewer_id AND b.blocked_id = uf.follower_id)
         OR (b.blocked_id = g.viewer_id AND b.blocker_id = uf.follower_id)
    )
  ORDER BY uf.created_at DESC
  LIMIT (SELECT n FROM lim);
$$;

CREATE OR REPLACE FUNCTION public.list_public_profile_following(
  p_user_id uuid,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gate AS (
    SELECT
      p_user_id AS uid,
      auth.uid() AS viewer_id,
      EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_user_id) AS has_profile,
      (auth.uid() IS NOT NULL AND auth.uid() = p_user_id) AS is_self,
      COALESCE(
        (SELECT pr.is_public FROM public.profiles pr WHERE pr.id = p_user_id),
        true
      ) AS profile_public
  ),
  lim AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)::integer AS n
  )
  SELECT uf.followee_id AS user_id
  FROM public.user_follows uf
  CROSS JOIN gate g
  CROSS JOIN lim l
  WHERE g.viewer_id IS NOT NULL
    AND g.has_profile
    AND (g.is_self OR g.profile_public IS TRUE)
    AND uf.follower_id = g.uid
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_blocks b
      WHERE (b.blocker_id = g.viewer_id AND b.blocked_id = uf.followee_id)
         OR (b.blocked_id = g.viewer_id AND b.blocker_id = uf.followee_id)
    )
  ORDER BY uf.created_at DESC
  LIMIT (SELECT n FROM lim);
$$;

COMMENT ON FUNCTION public.list_public_profile_followers(uuid, integer) IS
  'Follower user ids for a public profile (or own profile). Authenticated only; excludes users blocked with the viewer.';

COMMENT ON FUNCTION public.list_public_profile_following(uuid, integer) IS
  'Following user ids for a public profile (or own profile). Authenticated only; excludes users blocked with the viewer.';

REVOKE ALL ON FUNCTION public.list_public_profile_followers(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_profile_following(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_profile_followers(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_profile_following(uuid, integer) TO authenticated;
