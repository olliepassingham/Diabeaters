import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { HypoLogGotItButton } from "@/components/hypo-log-got-it-button";
import { hypoIdFromNotificationData } from "@/lib/hypo-log-acknowledgements";
import { notificationKind } from "@/lib/in-app-notification-display";

export function hypoLogIdFromInAppNotification(row: InAppNotificationRow): string | null {
  if (notificationKind(row) !== "hypo_logged") return null;
  return hypoIdFromNotificationData(row.data);
}

type HypoNotificationAckFooterProps = {
  row: InAppNotificationRow;
  acknowledged: boolean;
  onAcknowledged?: () => void;
};

export function HypoNotificationAckFooter({ row, acknowledged, onAcknowledged }: HypoNotificationAckFooterProps) {
  const hypoLogId = hypoLogIdFromInAppNotification(row);
  if (!hypoLogId) return null;
  return (
    <HypoLogGotItButton
      hypoLogId={hypoLogId}
      acknowledged={acknowledged}
      onAcknowledged={onAcknowledged}
    />
  );
}
