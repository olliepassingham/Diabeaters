import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/use-offline";
import {
  OFFLINE_BANNER_BASE,
  offlineBannerQueuedSuffix,
  readOfflineQueuedCount,
} from "@/lib/offline-messaging";

export function OfflineBanner() {
  const isOffline = useOffline();
  const [queuedCount, setQueuedCount] = useState(() => readOfflineQueuedCount());

  useEffect(() => {
    const update = () => setQueuedCount(readOfflineQueuedCount());
    update();
    window.addEventListener("diabeater:offline-queue-changed", update as EventListener);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("diabeater:offline-queue-changed", update as EventListener);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 bg-amber-500 py-1.5 text-[13px] leading-5 text-amber-950 [padding-left:max(0.75rem,env(safe-area-inset-left,0px))] [padding-right:max(0.75rem,env(safe-area-inset-right,0px))] pt-[max(0.375rem,env(safe-area-inset-top,0px))] pb-1.5"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span data-testid="offline-banner-message">{OFFLINE_BANNER_BASE}</span>
      {queuedCount > 0 && (
        <span
          className="ml-1 rounded-full bg-amber-950/10 px-2 py-0.5 text-xs font-medium"
          data-testid="offline-queued-count"
        >
          {offlineBannerQueuedSuffix(queuedCount)}
        </span>
      )}
    </div>
  );
}
