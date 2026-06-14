import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { acknowledgeHypoLog } from "@/lib/hypo-log-acknowledgements";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type HypoLogGotItButtonProps = {
  hypoLogId: string;
  /** When true, shows a compact “Acknowledged” state instead of the action. */
  acknowledged?: boolean;
  size?: "sm" | "default";
  className?: string;
  onAcknowledged?: () => void;
};

/** Supporter one-tap acknowledgement for a treated hypo log. */
export function HypoLogGotItButton({
  hypoLogId,
  acknowledged = false,
  size = "sm",
  className,
  onAcknowledged,
}: HypoLogGotItButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(acknowledged);

  if (done) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400",
          className,
        )}
        data-testid={`hypo-ack-done-${hypoLogId}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
        Acknowledged
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      className={cn("h-8 gap-1.5 rounded-full px-3 text-xs font-medium", className)}
      disabled={busy}
      data-testid={`hypo-ack-button-${hypoLogId}`}
      onClick={(e) => {
        e.stopPropagation();
        void (async () => {
          setBusy(true);
          const res = await acknowledgeHypoLog(hypoLogId);
          setBusy(false);
          if (res.error) {
            toast({
              title: "Could not acknowledge",
              description: res.error.message,
              variant: "destructive",
            });
            return;
          }
          void hapticLight();
          setDone(true);
          onAcknowledged?.();
          toast({ title: "They'll see you've got it", description: "Your acknowledgement was sent." });
        })();
      }}
    >
      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
      {busy ? "Sending…" : "Got it"}
    </Button>
  );
}
