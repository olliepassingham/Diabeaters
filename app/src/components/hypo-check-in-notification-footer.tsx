import { Button } from "@/components/ui/button";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import {
  carerNameFromCheckInNotification,
  checkInIdFromNotificationData,
} from "@/lib/hypo-check-ins";
import { notificationKind } from "@/lib/in-app-notification-display";
import { requestOpenHypoCheckInRespondSheet } from "@/lib/hypo-check-in-respond-deep-link";

export function hypoCheckInIdFromInAppNotification(row: InAppNotificationRow): string | null {
  if (notificationKind(row) !== "hypo_check_in") return null;
  return checkInIdFromNotificationData(row.data);
}

type HypoCheckInNotificationFooterProps = {
  row: InAppNotificationRow;
  responded?: boolean;
};

export function HypoCheckInNotificationFooter({
  row,
  responded = false,
}: HypoCheckInNotificationFooterProps) {
  const checkInId = hypoCheckInIdFromInAppNotification(row);
  if (!checkInId || responded) return null;

  const carerName = carerNameFromCheckInNotification(row.data);

  return (
    <div className="border-t border-border/40 pt-2.5">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 w-full rounded-lg text-xs"
        onClick={(e) => {
          e.stopPropagation();
          requestOpenHypoCheckInRespondSheet({ checkInId, carerName });
        }}
      >
        Respond to {carerName}
      </Button>
    </div>
  );
}
