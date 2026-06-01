-- Allow Android FCM tokens alongside iOS APNs tokens.

DO $$
BEGIN
  IF to_regclass('public.push_tokens') IS NULL THEN
    RETURN;
  END IF;

  -- Drop legacy CHECK if present (name may vary by project).
  BEGIN
    ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_platform_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  ALTER TABLE public.push_tokens
    ADD CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios', 'android'));
END $$;

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

  INSERT INTO public.push_tokens (user_id, platform, token)
  VALUES (uid, 'android', t)
  ON CONFLICT (user_id, platform, token)
  DO UPDATE SET updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.register_android_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_android_push_token(text) TO authenticated;

COMMENT ON FUNCTION public.register_android_push_token(text) IS
  'Upserts the caller''s Android FCM device token into public.push_tokens (Capacitor).';
