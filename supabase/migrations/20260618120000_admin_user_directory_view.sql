-- Dashboard-only directory: join auth.users (email) with public.profiles.
-- Not exposed to the app (anon/authenticated cannot SELECT).

CREATE OR REPLACE VIEW public.admin_user_directory
WITH (security_invoker = false)
AS
SELECT
  u.id,
  u.email,
  u.phone,
  u.created_at AS auth_created_at,
  u.last_sign_in_at,
  u.email_confirmed_at,
  p.full_name,
  p.public_handle,
  p.primary_app_role,
  p.account_type,
  p.is_public,
  p.onboarding_complete,
  p.diabetes_onset_date
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;

COMMENT ON VIEW public.admin_user_directory IS
  'Operator view for Supabase Dashboard / SQL Editor: email + profile fields. Not for client apps.';

REVOKE ALL ON public.admin_user_directory FROM PUBLIC;
REVOKE ALL ON public.admin_user_directory FROM anon;
REVOKE ALL ON public.admin_user_directory FROM authenticated;

GRANT SELECT ON public.admin_user_directory TO service_role;
