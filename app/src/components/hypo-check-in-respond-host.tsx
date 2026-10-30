import { useCallback, useEffect, useState } from "react";
import { HypoCheckInRespondSheet } from "@/components/hypo-check-in-respond-sheet";
import { useToast } from "@/hooks/use-toast";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import {
  consumePendingHypoCheckInRespond,
  OPEN_HYPO_CHECK_IN_RESPOND_EVENT,
  type PendingHypoCheckInRespond,
} from "@/lib/hypo-check-in-respond-deep-link";
import { fetchPendingHypoCheckIns, friendlyCreateCheckInError } from "@/lib/hypo-check-ins";

export function HypoCheckInRespondHost() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PendingHypoCheckInRespond | null>(null);

  const openWith = useCallback((payload: PendingHypoCheckInRespond) => {
    setTarget(payload);
    setOpen(true);
  }, []);

  useEffect(() => {
    const tryOpen = () => {
      const pending = consumePendingHypoCheckInRespond();
      if (!pending) return;

      void (async () => {
        const { data, error } = await fetchPendingHypoCheckIns();
        // If we can't confirm status (offline / RPC blip), still open — reply path maps errors.
        if (error) {
          openWith(pending);
          return;
        }
        if (!data.some((row) => row.id === pending.checkInId)) {
          toast({
            title: "Check-in timed out",
            description: friendlyCreateCheckInError("check_in_expired"),
          });
          return;
        }
        openWith(pending);
      })();
    };
    tryOpen();
    window.addEventListener(OPEN_HYPO_CHECK_IN_RESPOND_EVENT, tryOpen);
    return () => window.removeEventListener(OPEN_HYPO_CHECK_IN_RESPOND_EVENT, tryOpen);
  }, [openWith, toast]);

  if (!target) return null;

  return (
    <HypoCheckInRespondSheet
      open={open}
      onOpenChange={setOpen}
      checkInId={target.checkInId}
      carerName={target.carerName}
      glucoseConcern={target.glucoseConcern}
      onResponded={() => {
        setTarget(null);
        notifyInAppNotificationsChanged({ skipPageRefresh: true });
      }}
    />
  );
}
