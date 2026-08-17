import { useEffect } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HypoCheckInPrompt, HypoCheckInResponseActions } from "@/components/hypo-check-in-response-actions";
import { shouldOfferLogHypo, type GlucoseConcern } from "@/lib/hypo-check-in-copy";
import { DIABEATER_OPEN_HYPO_DIALOG_EVENT } from "@/lib/hypo-check-in-events";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInId: string;
  carerName: string;
  glucoseConcern?: GlucoseConcern;
  onResponded?: () => void;
};

export function HypoCheckInRespondSheet({
  open,
  onOpenChange,
  checkInId,
  carerName,
  glucoseConcern = "unknown",
  onResponded,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onOpenLog = () => onOpenChange(false);
    window.addEventListener(DIABEATER_OPEN_HYPO_DIALOG_EVENT, onOpenLog);
    return () => window.removeEventListener(DIABEATER_OPEN_HYPO_DIALOG_EVENT, onOpenLog);
  }, [open, onOpenChange]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Respond to ${carerName}`}
      description="Choose the option that best fits how you're doing right now. They'll be notified straight away."
      bodyClassName="overflow-y-auto overscroll-contain px-4 pb-6"
    >
      <div className="space-y-5" data-testid="hypo-check-in-respond-sheet">
        <HypoCheckInPrompt carerName={carerName} glucoseConcern={glucoseConcern} />
        <HypoCheckInResponseActions
          checkInId={checkInId}
          carerName={carerName}
          glucoseConcern={glucoseConcern}
          layout="sheet"
          onResponded={() => {
            onResponded?.();
            onOpenChange(false);
          }}
        />
        {shouldOfferLogHypo(glucoseConcern) ? (
          <p className="text-center text-xs text-muted-foreground">
            Only log a hypo if you actually had one — a quick &ldquo;I&apos;m OK&rdquo; is enough when you&apos;re fine.
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            A quick &ldquo;I&apos;m OK&rdquo; or &ldquo;I&apos;ve sorted it&rdquo; is enough — they just want to know
            you&apos;re on it.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
