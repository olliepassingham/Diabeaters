import { useState } from "react";
import { X } from "lucide-react";
import { isStaging } from "@/lib/flags";

/** Fixed top ribbon shown only in staging. Never rendered in production. */
export function StagingBanner() {
  if (!isStaging) return null;

  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-500/95 text-amber-950 px-4 py-2 flex items-center justify-between gap-2 shadow-sm"
      role="alert"
      data-testid="staging-banner"
    >
      <span className="text-sm font-medium">
        Staging — not for real use
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded hover:bg-amber-400/50"
        aria-label="Dismiss staging banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
