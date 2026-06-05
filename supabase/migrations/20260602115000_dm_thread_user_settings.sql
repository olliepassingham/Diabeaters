-- DM per-user settings: mute + hide (delete from list) per conversation.
-- Required by count_unread_dm_threads_for_user (push badge) and notify_dm_push mute/hide checks.

CREATE TABLE IF NOT EXISTS public.dm_thread_user_settings (
  thread_id uuid NOT NULL REFERENCES public.dm_threads (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  muted boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS dm_thread_user_settings_user_id_idx
  ON public.dm_thread_user_settings (user_id);

CREATE INDEX IF NOT EXISTS dm_thread_user_settings_thread_id_idx
  ON public.dm_thread_user_settings (thread_id);

CREATE OR REPLACE FUNCTION public.dm_thread_user_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dm_thread_user_settings_touch_updated_at ON public.dm_thread_user_settings;
CREATE TRIGGER dm_thread_user_settings_touch_updated_at
  BEFORE UPDATE ON public.dm_thread_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.dm_thread_user_settings_set_updated_at();

ALTER TABLE public.dm_thread_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dm_thread_user_settings_select_own ON public.dm_thread_user_settings;
CREATE POLICY dm_thread_user_settings_select_own
  ON public.dm_thread_user_settings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.dm_thread_has_member(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS dm_thread_user_settings_insert_own ON public.dm_thread_user_settings;
CREATE POLICY dm_thread_user_settings_insert_own
  ON public.dm_thread_user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.dm_thread_has_member(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS dm_thread_user_settings_update_own ON public.dm_thread_user_settings;
CREATE POLICY dm_thread_user_settings_update_own
  ON public.dm_thread_user_settings
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.dm_thread_has_member(thread_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.dm_thread_has_member(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS dm_thread_user_settings_delete_own ON public.dm_thread_user_settings;
CREATE POLICY dm_thread_user_settings_delete_own
  ON public.dm_thread_user_settings
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.dm_thread_has_member(thread_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.upsert_dm_thread_user_settings(
  p_thread_id uuid,
  p_muted boolean DEFAULT NULL,
  p_hidden boolean DEFAULT NULL
)
RETURNS public.dm_thread_user_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.dm_thread_user_settings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_thread_id IS NULL THEN
    RAISE EXCEPTION 'thread required';
  END IF;
  IF NOT public.dm_thread_has_member(p_thread_id, v_uid) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  INSERT INTO public.dm_thread_user_settings (thread_id, user_id, muted, hidden)
  VALUES (
    p_thread_id,
    v_uid,
    COALESCE(p_muted, false),
    COALESCE(p_hidden, false)
  )
  ON CONFLICT (thread_id, user_id) DO UPDATE SET
    muted = COALESCE(EXCLUDED.muted, public.dm_thread_user_settings.muted),
    hidden = COALESCE(EXCLUDED.hidden, public.dm_thread_user_settings.hidden),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_dm_thread_user_settings(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_dm_thread_user_settings(uuid, boolean, boolean) TO authenticated;

COMMENT ON TABLE public.dm_thread_user_settings IS 'Per-user DM thread preferences (mute/hide).';
COMMENT ON FUNCTION public.upsert_dm_thread_user_settings(uuid, boolean, boolean) IS 'Upsert per-user DM settings (mute/hide) for the current user.';
