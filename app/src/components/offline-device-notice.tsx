import { WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOffline } from "@/hooks/use-offline";
import {
  OFFLINE_DEVICE_NOTICE,
  OFFLINE_SUPPLIES_NOTICE,
  offlineQueuedChangesLabel,
  readOfflineQueuedCount,
} from "@/lib/offline-messaging";
import { cn } from "@/lib/utils";

type OfflineDeviceNoticeProps = {
  className?: string;
  /** Supplies page — mention queued stock sync explicitly. */
  variant?: "default" | "supplies";
};

/**
 * Page-level hint when offline: local data is available; cloud features are not.
 */
export function OfflineDeviceNotice({ className, variant = "default" }: OfflineDeviceNoticeProps) {
  const isOffline = useOffline();
  if (!isOffline) return null;

  const queued = readOfflineQueuedCount();
  const base = variant === "supplies" ? OFFLINE_SUPPLIES_NOTICE : OFFLINE_DEVICE_NOTICE;
  const queuedLabel = variant === "supplies" && queued > 0 ? offlineQueuedChangesLabel(queued) : null;

  return (
    <Alert
      className={cn("border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100", className)}
      data-testid="offline-device-notice"
      role="status"
    >
      <WifiOff className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
      <AlertDescription className="text-sm leading-relaxed text-amber-950 dark:text-amber-50">
        {base}
        {queuedLabel ? ` ${queuedLabel}.` : null}
      </AlertDescription>
    </Alert>
  );
}
