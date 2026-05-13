-- Reliable iOS push token persistence from the mobile app.
-- Direct client upserts can fail when RLS policies or GRANTs drift; this RPC runs
-- as SECURITY DEFINER and only inserts/updates a row for auth.uid().

CREATE OR REPLACE FUNCTION public.register_ios_push_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u uuid;
  t text;
BEGIN
  u := auth.uid();
  IF u IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  t := trim(p_token);
  IF t IS NULL OR length(t) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  INSERT INTO public.push_tokens (user_id, platform, token)
  VALUES (u, 'ios', t)
  ON CONFLICT (user_id, platform, token)
  DO UPDATE SET updated_at = now();

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_ios_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_ios_push_token(text) TO authenticated;

COMMENT ON FUNCTION public.register_ios_push_token(text) IS
  'Upserts the caller''s iOS device push token into public.push_tokens (Capacitor).';
