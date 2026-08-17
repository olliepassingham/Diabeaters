import { useState } from "react";
import { CheckCircle2, Droplet, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  respondHypoCheckIn,
  setPendingHypoCheckInForLog,
  type HypoCheckInResponse,
} from "@/lib/hypo-check-ins";
import {
  checkInPatientPrompt,
  shouldOfferLogHypo,
  type GlucoseConcern,
} from "@/lib/hypo-check-in-copy";
import { DIABEATER_OPEN_HYPO_DIALOG_EVENT } from "@/lib/hypo-check-in-events";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type HypoCheckInResponseActionsProps = {
  checkInId: string;
  carerName?: string;
  glucoseConcern?: GlucoseConcern;
  /** @deprecated Use `layout` instead. */
  compact?: boolean;
  layout?: "inline" | "sheet";
  className?: string;
  onResponded?: () => void;
};

function promptAccentClass(concern: GlucoseConcern): string {
  if (concern === "high") return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (concern === "low") return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  return "bg-primary/10 text-primary";
}

export function HypoCheckInResponseActions({
  checkInId,
  carerName = "Your supporter",
  glucoseConcern = "unknown",
  compact = false,
  layout,
  className,
  onResponded,
}: HypoCheckInResponseActionsProps) {
  const resolvedLayout = layout ?? (compact ? "inline" : "inline");
  const { toast } = useToast();
  const [busy, setBusy] = useState<HypoCheckInResponse | "log" | null>(null);
  const [done, setDone] = useState(false);
  const offerLogHypo = shouldOfferLogHypo(glucoseConcern);

  const respond = async (response: HypoCheckInResponse) => {
    setBusy(response);
    const res = await respondHypoCheckIn({ checkInId, response });
    setBusy(null);
    if (res.error) {
      toast({
        title: "Could not send reply",
        description: res.error.message,
        variant: "destructive",
      });
      return;
    }
    void hapticLight();
    setDone(true);
    onResponded?.();
    toast({
      title: "Reply sent",
      description: `${carerName} will see your update.`,
    });
  };

  const openLogHypo = () => {
    setPendingHypoCheckInForLog(checkInId);
    setBusy("log");
    window.dispatchEvent(new Event(DIABEATER_OPEN_HYPO_DIALOG_EVENT));
    window.setTimeout(() => setBusy(null), 400);
  };

  if (done) {
    return (
      <p className={cn("text-xs font-medium text-emerald-700 dark:text-emerald-400", className)}>
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Reply sent
      </p>
    );
  }

  return (
    <div
      className={cn(
        resolvedLayout === "sheet" ? "flex flex-col gap-2.5" : "flex flex-col gap-2 sm:flex-row sm:flex-wrap",
        className,
      )}
    >
      <Button
        type="button"
        size={resolvedLayout === "sheet" ? "lg" : "sm"}
        variant="secondary"
        className={cn(
          resolvedLayout === "sheet"
            ? "h-12 w-full rounded-xl text-base font-medium"
            : "h-8 rounded-full px-3 text-xs",
        )}
        disabled={busy != null}
        onClick={(e) => {
          e.stopPropagation();
          void respond("ok");
        }}
        data-testid={`hypo-check-in-ok-${checkInId}`}
      >
        {busy === "ok" ? "Sending…" : "I'm OK"}
      </Button>
      <Button
        type="button"
        size={resolvedLayout === "sheet" ? "lg" : "sm"}
        variant="outline"
        className={cn(
          resolvedLayout === "sheet"
            ? "h-12 w-full rounded-xl text-base font-medium"
            : "h-8 rounded-full px-3 text-xs",
        )}
        disabled={busy != null}
        onClick={(e) => {
          e.stopPropagation();
          void respond("treating");
        }}
        data-testid={`hypo-check-in-treating-${checkInId}`}
      >
        {busy === "treating" ? "Sending…" : "I've sorted it"}
      </Button>
      {offerLogHypo ? (
        <Button
          type="button"
          size={resolvedLayout === "sheet" ? "lg" : "sm"}
          className={cn(
            resolvedLayout === "sheet"
              ? "h-12 w-full rounded-xl text-base font-medium"
              : "h-8 rounded-full px-3 text-xs",
          )}
          disabled={busy != null}
          onClick={(e) => {
            e.stopPropagation();
            openLogHypo();
          }}
          data-testid={`hypo-check-in-log-${checkInId}`}
        >
          <Droplet className={cn("h-4 w-4", resolvedLayout === "sheet" ? "mr-2" : "mr-1 h-3.5 w-3.5")} aria-hidden />
          {busy === "log" ? "Opening…" : "Log hypo"}
        </Button>
      ) : null}
    </div>
  );
}

export function HypoCheckInPrompt({
  carerName,
  glucoseConcern = "unknown",
  className,
}: {
  carerName: string;
  glucoseConcern?: GlucoseConcern;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          promptAccentClass(glucoseConcern),
        )}
      >
        <HeartHandshake className="h-4 w-4" aria-hidden />
      </span>
      <p className="text-sm leading-snug text-foreground">{checkInPatientPrompt(carerName, glucoseConcern)}</p>
    </div>
  );
}
