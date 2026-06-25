import { useCallback, useEffect, useState } from "react";
import { fetchPendingHypoCheckIns } from "@/lib/hypo-check-ins";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";

export function usePendingHypoCheckInIds(userId: string | undefined) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!userId) {
      setPendingIds(new Set());
      return;
    }
    try {
      const res = await fetchPendingHypoCheckIns();
      if (res.error) return;
      setPendingIds(new Set(res.data.map((row) => row.id)));
    } catch {
      // Ignore — hypo check-ins are optional; never break notifications UI.
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onChanged);
    const id = window.setInterval(() => void refresh(), 45_000);
    return () => {
      window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onChanged);
      window.clearInterval(id);
    };
  }, [refresh]);

  const isPending = useCallback((checkInId: string) => pendingIds.has(checkInId), [pendingIds]);

  return { pendingIds, isPending, refresh };
}
