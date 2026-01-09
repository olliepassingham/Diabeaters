import { WifiOff } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";

export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span>You're offline. Some features may be limited.</span>
    </div>
  );
}
