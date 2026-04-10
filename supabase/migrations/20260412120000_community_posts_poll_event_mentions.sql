-- Polls, events, @mentions: post_kind + post_extra + mention_map + mentioned_user_ids + community_poll_votes + notifications.

-- ---------------------------------------------------------------------------
-- Columns on community_posts
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'standard';

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_post_kind_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_post_kind_check CHECK (
  post_kind IN ('standard', 'poll', 'event')
);

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS post_extra jsonb NULL;

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS mention_map jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN public.community_posts.post_kind IS 'standard | poll | event';
COMMENT ON COLUMN public.community_posts.post_extra IS 'Poll: {question, options[]}. Event: {title, starts_at, location?, details?}.';
COMMENT ON COLUMN public.community_posts.mention_map IS 'Lowercase @handle -> author uuid for rendering mentions.';
COMMENT ON COLUMN public.community_posts.mentioned_user_ids IS 'Tagged users (excluding author); drives mention notifications.';

-- Replace body/images constraint: standard needs text or images; poll/event forbid images.
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_and_images_check;

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_images_kind_check;

ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_images_kind_check CHECK (
  char_length(body) <= 8000
  AND (
    post_kind <> 'standard'
    OR (
      char_length(trim(body)) >= 1
      OR jsonb_array_length(coalesce(image_urls, '[]'::jsonb)) >= 1
    )
  )
  AND (
    post_kind = 'standard'
    OR jsonb_array_length(coalesce(image_urls, '[]'::jsonb)) = 0
  )
);

CREATE OR REPLACE FUNCTION public.community_posts_validate_post_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n_opt int;
  i int;
  opt text;
BEGIN
  IF NEW.post_kind = 'standard' THEN
    IF NEW.post_extra IS NOT NULL THEN
      RAISE EXCEPTION 'standard posts must have null post_extra';
    END IF;
  ELSIF NEW.post_kind = 'poll' THEN
    IF NEW.post_extra IS NULL OR jsonb_typeof(NEW.post_extra) <> 'object' THEN
      RAISE EXCEPTION 'poll requires post_extra object';
    END IF;
    IF length(trim(coalesce(NEW.post_extra->>'question', ''))) < 1 THEN
      RAISE EXCEPTION 'poll requires a question';
    END IF;
    IF jsonb_typeof(NEW.post_extra->'options') <> 'array' THEN
      RAISE EXCEPTION 'poll requires options array';
    END IF;
    n_opt := jsonb_array_length(NEW.post_extra->'options');
    IF n_opt < 2 OR n_opt > 6 THEN
      RAISE EXCEPTION 'poll must have between 2 and 6 options';
    END IF;
    FOR i IN 0..n_opt - 1 LOOP
      opt := trim(NEW.post_extra->'options'->>i);
      IF opt IS NULL OR length(opt) < 1 OR length(opt) > 500 THEN
        RAISE EXCEPTION 'poll option % invalid', i;
      END IF;
    END LOOP;
  ELSIF NEW.post_kind = 'event' THEN
    IF NEW.post_extra IS NULL OR jsonb_typeof(NEW.post_extra) <> 'object' THEN
      RAISE EXCEPTION 'event requires post_extra object';
    END IF;
    IF length(trim(coalesce(NEW.post_extra->>'title', ''))) < 1 THEN
      RAISE EXCEPTION 'event requires a title';
    END IF;
    IF length(trim(coalesce(NEW.post_extra->>'starts_at', ''))) < 10 THEN
      RAISE EXCEPTION 'event requires starts_at (ISO date)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_validate_row_trigger ON public.community_posts;
CREATE TRIGGER community_posts_validate_row_trigger
  BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.community_posts_validate_post_row();

-- ---------------------------------------------------------------------------
-- Poll votes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_poll_votes (
  post_id uuid NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT community_poll_votes_option_index_nonnegative CHECK (option_index >= 0),
  CONSTRAINT community_poll_votes_option_index_max CHECK (option_index <= 15)
);

CREATE INDEX IF NOT EXISTS community_poll_votes_post_id_idx ON public.community_poll_votes (post_id);

ALTER TABLE public.community_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_poll_votes_select_not_blocked ON public.community_poll_votes;
CREATE POLICY community_poll_votes_select_not_blocked
  ON public.community_poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = community_poll_votes.post_id
        AND p.post_kind = 'poll'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = community_poll_votes.user_id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = community_poll_votes.user_id)
    )
  );

DROP POLICY IF EXISTS community_poll_votes_insert_own ON public.community_poll_votes;
CREATE POLICY community_poll_votes_insert_own
  ON public.community_poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
        AND p.post_kind = 'poll'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
             OR (b.blocked_id = auth.uid() AND b.blocker_id = p.author_id)
        )
    )
  );

DROP POLICY IF EXISTS community_poll_votes_update_own ON public.community_poll_votes;
CREATE POLICY community_poll_votes_update_own
  ON public.community_poll_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_poll_votes_delete_own ON public.community_poll_votes;
CREATE POLICY community_poll_votes_delete_own
  ON public.community_poll_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notify mentioned users (same delivery prefs as feed like/comment)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_community_post_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_uid uuid;
  actor_label text;
  dl text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  dl := '/community/post/' || NEW.id::text;
  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Someone') INTO actor_label
  FROM public.profiles
  WHERE id = NEW.author_id;
  IF actor_label IS NULL THEN
    actor_label := 'Someone';
  END IF;
  FOREACH mention_uid IN ARRAY NEW.mentioned_user_ids
  LOOP
    IF mention_uid IS NULL OR mention_uid = NEW.author_id THEN
      CONTINUE;
    END IF;
    IF NOT public.should_deliver_feed_inapp(mention_uid) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, title, body, data, read)
    VALUES (
      mention_uid,
      'You were mentioned on the feed',
      actor_label || ' tagged you in a post.',
      jsonb_build_object(
        'kind', 'feed_post_mention',
        'post_id', NEW.id::text,
        'actor_user_id', NEW.author_id::text,
        'deep_link', dl
      ),
      false
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_notify_mentions ON public.community_posts;
CREATE TRIGGER community_posts_notify_mentions
  AFTER INSERT ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_post_mentions();
