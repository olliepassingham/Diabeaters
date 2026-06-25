import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { HypoCheckInResponseActions, HypoCheckInPrompt } from "@/components/hypo-check-in-response-actions";
import {
  carerNameFromCheckInNotification,
  checkInIdFromNotificationData,
} from "@/lib/hypo-check-ins";
import { notificationKind } from "@/lib/in-app-notification-display";

export function hypoCheckInIdFromInAppNotification(row: InAppNotificationRow): string | null {
  if (notificationKind(row) !== "hypo_check_in") return null;
  return checkInIdFromNotificationData(row.data);
}

type HypoCheckInNotificationFooterProps = {
  row: InAppNotificationRow;
  responded?: boolean;
  onResponded?: () => void;
};

export function HypoCheckInNotificationFooter({
  row,
  responded = false,
  onResponded,
}: HypoCheckInNotificationFooterProps) {
  const checkInId = hypoCheckInIdFromInAppNotification(row);
  if (!checkInId || responded) return null;

  const carerName = carerNameFromCheckInNotification(row.data);

  return (
    <div className="space-y-2.5 border-t border-border/40 pt-2.5">
      <HypoCheckInPrompt carerName={carerName} />
      <HypoCheckInResponseActions
        checkInId={checkInId}
        carerName={carerName}
        compact
        onResponded={onResponded}
      />
    </div>
  );
}
