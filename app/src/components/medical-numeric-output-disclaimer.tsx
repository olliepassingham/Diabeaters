import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const DISCLAIMER_BODY =
  "Diabeaters is not a medical device. These numbers are not a prescription. Confirm any doses or treatment changes with your diabetes team. Seek emergency care for severe hypoglycaemia, DKA symptoms, or any emergency.";

/** Prominent non-device framing for screens that show insulin doses, corrections, or carb treatment amounts. */
export function MedicalNumericOutputDisclaimer({
  className,
  compact,
  collapsible,
}: {
  className?: string;
  /** Slightly tighter padding for dense layouts */
  compact?: boolean;
  /** One-line summary; tap to expand full disclaimer. */
  collapsible?: boolean;
}) {
  if (collapsible) {
    return (
      <Collapsible className={cn("rounded-lg border border-amber-200/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/25", className)}>
        <CollapsibleTrigger
          className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-amber-950 dark:text-amber-100"
          data-testid="alert-medical-numeric-disclaimer-trigger"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
            Educational estimate only
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-amber-800/80 transition-transform group-data-[state=open]:rotate-180 dark:text-amber-200/80" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-2.5 pt-0">
          <p className="text-[11px] leading-snug text-amber-900/90 dark:text-amber-100/85">{DISCLAIMER_BODY}</p>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Alert
      data-testid="alert-medical-numeric-disclaimer"
      className={cn(
        "border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100",
        compact ? "py-2" : "",
        className,
      )}
    >
      <ShieldAlert className="h-4 w-4 text-amber-800 dark:text-amber-200" aria-hidden />
      <AlertTitle className="text-sm font-semibold text-amber-950 dark:text-amber-50">
        Educational estimate only
      </AlertTitle>
      <AlertDescription className="text-xs text-amber-900/90 dark:text-amber-100/90 leading-snug">
        {DISCLAIMER_BODY}
      </AlertDescription>
    </Alert>
  );
}
