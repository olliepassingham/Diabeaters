-- Keep one active device token per platform: reinstalls/TestFlight upgrades register a new
-- APNs token but old rows remained, so pushes were sent to invalid tokens.

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

  DELETE FROM public.push_tokens
  WHERE user_id = u AND platform = 'ios' AND token IS DISTINCT FROM t;

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

CREATE OR REPLACE FUNCTION public.register_android_push_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t text := trim(coalesce(p_token, ''));
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF length(t) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  DELETE FROM public.push_tokens
  WHERE user_id = uid AND platform = 'android' AND token IS DISTINCT FROM t;

  INSERT INTO public.push_tokens (user_id, platform, token)
  VALUES (uid, 'android', t)
  ON CONFLICT (user_id, platform, token)
  DO UPDATE SET updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
