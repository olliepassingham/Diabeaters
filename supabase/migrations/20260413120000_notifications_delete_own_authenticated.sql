-- Let signed-in users delete their own in-app notification rows (clear inbox from the app).

GRANT DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
