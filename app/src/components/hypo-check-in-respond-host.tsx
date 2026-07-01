import { useCallback, useEffect, useState } from "react";
import { HypoCheckInRespondSheet } from "@/components/hypo-check-in-respond-sheet";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import {
  consumePendingHypoCheckInRespond,
  OPEN_HYPO_CHECK_IN_RESPOND_EVENT,
  type PendingHypoCheckInRespond,
} from "@/lib/hypo-check-in-respond-deep-link";

export function HypoCheckInRespondHost() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PendingHypoCheckInRespond | null>(null);

  const openWith = useCallback((payload: PendingHypoCheckInRespond) => {
    setTarget(payload);
    setOpen(true);
  }, []);

  useEffect(() => {
    const tryOpen = () => {
      const pending = consumePendingHypoCheckInRespond();
      if (pending) openWith(pending);
    };
    tryOpen();
    window.addEventListener(OPEN_HYPO_CHECK_IN_RESPOND_EVENT, tryOpen);
    return () => window.removeEventListener(OPEN_HYPO_CHECK_IN_RESPOND_EVENT, tryOpen);
  }, [openWith]);

  if (!target) return null;

  return (
    <HypoCheckInRespondSheet
      open={open}
      onOpenChange={setOpen}
      checkInId={target.checkInId}
      carerName={target.carerName}
      onResponded={() => {
        setTarget(null);
        notifyInAppNotificationsChanged({ skipPageRefresh: true });
      }}
    />
  );
}
