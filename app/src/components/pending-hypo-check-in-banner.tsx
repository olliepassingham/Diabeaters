import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchPendingHypoCheckIns, type PendingHypoCheckIn } from "@/lib/hypo-check-ins";
import { HypoCheckInPrompt, HypoCheckInResponseActions } from "@/components/hypo-check-in-response-actions";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";
import { getSupabase } from "@/lib/supabase";

export function PendingHypoCheckInBanner() {
  const [pending, setPending] = useState<PendingHypoCheckIn[]>([]);

  const refresh = useCallback(async () => {
    if (!getSupabase()) {
      setPending([]);
      return;
    }
    try {
      const res = await fetchPendingHypoCheckIns();
      if (!res.error) setPending(res.data);
    } catch {
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onChanged);
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onChanged);
      window.clearInterval(id);
    };
  }, [refresh]);

  if (pending.length === 0) return null;

  const first = pending[0]!;

  return (
    <Card
      variant="glass-muted"
      className="border-rose-500/30 bg-rose-500/[0.05] shadow-sm"
      data-testid="pending-hypo-check-in-banner"
    >
      <CardContent className="space-y-3 p-4">
        <HypoCheckInPrompt carerName={first.carer_name} />
        <HypoCheckInResponseActions
          checkInId={first.id}
          carerName={first.carer_name}
          onResponded={() => void refresh()}
        />
        {pending.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            +{pending.length - 1} more check-in{pending.length - 1 === 1 ? "" : "s"} in your notifications
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
