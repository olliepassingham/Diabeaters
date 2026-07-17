import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchPendingHypoCheckIns, type PendingHypoCheckIn } from "@/lib/hypo-check-ins";
import { HypoCheckInPrompt } from "@/components/hypo-check-in-response-actions";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";
import { requestOpenHypoCheckInRespondSheet } from "@/lib/hypo-check-in-respond-deep-link";
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

  function openRespondSheet() {
    requestOpenHypoCheckInRespondSheet({
      checkInId: first.id,
      carerName: first.carer_name,
    });
  }

  return (
    <Card
      variant="glass-muted"
      className="border-rose-500/30 bg-rose-500/[0.05] shadow-sm dark:bg-rose-950/30"
      data-testid="pending-hypo-check-in-banner"
    >
      <CardContent className="p-0">
        <button
          type="button"
          onClick={openRespondSheet}
          className="flex w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-rose-500/[0.04] dark:hover:bg-rose-950/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <HypoCheckInPrompt carerName={first.carer_name} />
            <p className="text-xs font-medium text-primary">Tap to respond</p>
            {pending.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                +{pending.length - 1} more check-in{pending.length - 1 === 1 ? "" : "s"} waiting
              </p>
            ) : null}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </CardContent>
    </Card>
  );
}
