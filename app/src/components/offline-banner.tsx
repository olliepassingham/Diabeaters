import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/use-offline";
import { getQueueLength } from "@/lib/offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  const [queuedCount, setQueuedCount] = useState(() => getQueueLength());

  useEffect(() => {
    const update = () => setQueuedCount(getQueueLength());
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
      <WifiOff className="h-4 w-4" />
      <span>You&apos;re offline. Some features may be limited.</span>
      {queuedCount > 0 && (
        <span
          className="ml-1 rounded-full bg-amber-950/10 px-2 py-0.5 text-xs font-medium"
          data-testid="offline-queued-count"
        >
          {queuedCount} change{queuedCount === 1 ? "" : "s"} queued
        </span>
      )}
    </div>
  );
}
