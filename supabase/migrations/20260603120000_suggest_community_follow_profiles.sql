-- Ranked follow suggestions for the community Following tab (SECURITY DEFINER).
-- Combines: follows-you, followed-by-your-network, commenters on your posts,
-- authors in topics you post in, and recent feed activity. Only public profiles with @handles.

CREATE OR REPLACE FUNCTION public.suggest_community_follow_profiles(p_limit integer DEFAULT 12)
RETURNS TABLE (
  user_id uuid,
  score integer,
  primary_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT auth.uid() AS vid
  ),
  excluded AS (
    SELECT v.vid AS user_id FROM viewer v WHERE v.vid IS NOT NULL
    UNION
    SELECT uf.followee_id
    FROM public.user_follows uf
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL AND uf.follower_id = v.vid
    UNION
    SELECT ub.blocked_id
    FROM public.user_blocks ub
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL AND ub.blocker_id = v.vid
    UNION
    SELECT ub.blocker_id
    FROM public.user_blocks ub
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL AND ub.blocked_id = v.vid
  ),
  eligible AS (
    SELECT pr.id
    FROM public.profiles pr
    WHERE COALESCE(pr.is_public, true) IS TRUE
      AND pr.public_handle IS NOT NULL
      AND trim(pr.public_handle) <> ''
  ),
  viewer_topics AS (
    SELECT DISTINCT p.topic
    FROM public.community_posts p
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL
      AND p.author_id = v.vid
      AND p.topic IS NOT NULL
      AND trim(p.topic) <> ''
      AND p.created_at > (now() - interval '180 days')
    LIMIT 6
  ),
  weighted AS (
    SELECT uf.follower_id AS uid, 100 AS w, 'follows_you' AS reason
    FROM public.user_follows uf
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL AND uf.followee_id = v.vid

    UNION ALL

    SELECT uf2.followee_id,
      LEAST(135, COUNT(DISTINCT uf1.followee_id)::integer * 45),
      'followed_by_network'
    FROM public.user_follows uf1
    JOIN public.user_follows uf2 ON uf2.follower_id = uf1.followee_id
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL
      AND uf1.follower_id = v.vid
      AND uf2.followee_id IS DISTINCT FROM v.vid
    GROUP BY uf2.followee_id
    HAVING COUNT(DISTINCT uf1.followee_id) >= 1

    UNION ALL

    SELECT c.author_id, 70, 'commented_on_your_post'
    FROM public.community_post_comments c
    JOIN public.community_posts p ON p.id = c.post_id
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL
      AND p.author_id = v.vid
      AND c.author_id IS DISTINCT FROM v.vid
      AND c.created_at > (now() - interval '90 days')
    GROUP BY c.author_id

    UNION ALL

    SELECT p.author_id, LEAST(80, COUNT(*)::integer * 20), 'similar_topics'
    FROM public.community_posts p
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL
      AND p.author_id IS DISTINCT FROM v.vid
      AND p.topic IN (SELECT topic FROM viewer_topics)
      AND p.created_at > (now() - interval '45 days')
    GROUP BY p.author_id
    HAVING COUNT(*) >= 1

    UNION ALL

    SELECT recent.author_id, 25, 'active_in_feed'
    FROM (
      SELECT cp.author_id
      FROM public.community_posts cp
      ORDER BY cp.created_at DESC
      LIMIT 60
    ) recent
    CROSS JOIN viewer v
    WHERE v.vid IS NOT NULL
      AND recent.author_id IS DISTINCT FROM v.vid
    GROUP BY recent.author_id
  ),
  ranked AS (
    SELECT
      w.uid AS user_id,
      SUM(w.w)::integer AS score,
      (array_agg(w.reason ORDER BY w.w DESC, w.reason))[1] AS primary_reason
    FROM weighted w
    WHERE w.uid IS NOT NULL
      AND w.uid NOT IN (SELECT user_id FROM excluded)
      AND w.uid IN (SELECT id FROM eligible)
    GROUP BY w.uid
  )
  SELECT r.user_id, r.score, r.primary_reason
  FROM ranked r
  CROSS JOIN viewer v
  WHERE v.vid IS NOT NULL
  ORDER BY r.score DESC, r.user_id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 24));
$$;

COMMENT ON FUNCTION public.suggest_community_follow_profiles(integer) IS
  'Returns ranked public profile ids to follow for auth.uid(); excludes self, existing follows, and blocks.';

REVOKE ALL ON FUNCTION public.suggest_community_follow_profiles(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_community_follow_profiles(integer) TO authenticated;
