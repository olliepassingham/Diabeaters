import { useState } from "react";
import {
  getSupabaseConfigWarnings,
  getRedirectUrlsCopyBlock,
} from "@/lib/supabaseConfigCheck";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

export function DevBanner() {
  if (import.meta.env.PROD) return null;
  if (!import.meta.env.DEV) return null;

  const [dismissed, setDismissed] = useState(false);
  const warnings = getSupabaseConfigWarnings();
  const { toast } = useToast();

  if (warnings.length === 0 || dismissed) return null;

  const handleCopy = () => {
    const block = getRedirectUrlsCopyBlock();
    navigator.clipboard.writeText(block);
    toast({
      title: "Copied",
      description: "Redirect URLs copied to clipboard.",
    });
  };

  return (
    <div
      className="bg-amber-500/90 text-amber-950 px-4 py-3 flex flex-col gap-2 relative z-50"
      role="alert"
      data-testid="dev-banner-supabase"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">Supabase configuration</p>
          <ul className="mt-1 text-sm list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded hover:bg-amber-400/50"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="self-start text-sm font-medium underline underline-offset-2 hover:no-underline"
      >
        Copy required redirect URLs
      </button>
    </div>
  );
}
