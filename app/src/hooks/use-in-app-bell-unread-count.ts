import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";
import { countUnreadInAppNotificationsExcludingDm } from "@/lib/native-app-badge-count";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Unread count for the notification bell icon — always from the DB (not the capped inbox list).
 */
export function useInAppBellUnreadCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.id) {
      setCount(0);
      return;
    }
    const res = await countUnreadInAppNotificationsExcludingDm();
    setCount(res.error ? 0 : res.count);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onChange);
    return () => window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onChange);
  }, [refresh]);

  return count;
}
