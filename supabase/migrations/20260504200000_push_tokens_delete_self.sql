-- Allow signed-in users to DELETE their own push_tokens rows.
--
-- The client (`auth.ts logout()` + `push-tokens.ts cleanupPushRegistration()`)
-- calls this on logout to make sure a device that has signed out stops
-- receiving push for the previous user. The supabase_auth_admin policy that
-- already exists handles cascading delete on full account deletion; this
-- new policy is the everyday "logout" path for a single device.
--
-- Idempotent: only runs if `public.push_tokens` exists.

DO $$
BEGIN
  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT DELETE ON public.push_tokens TO authenticated';
    EXECUTE 'DROP POLICY IF EXISTS push_tokens_delete_self ON public.push_tokens';
    EXECUTE $p$
      CREATE POLICY push_tokens_delete_self
        ON public.push_tokens
        AS PERMISSIVE
        FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id)
    $p$;
  END IF;
END $$;
