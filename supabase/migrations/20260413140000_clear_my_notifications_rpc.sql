-- Reliable clear-all for in-app inbox: runs as definer so it works even if client DELETE RLS is missing.
CREATE OR REPLACE FUNCTION public.clear_my_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.notifications WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.clear_my_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_notifications() TO authenticated;

COMMENT ON FUNCTION public.clear_my_notifications() IS 'Deletes all in-app notification rows for the current user.';
