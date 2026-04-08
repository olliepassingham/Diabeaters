import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Prominent non-device framing for screens that show insulin doses, corrections, or carb treatment amounts. */
export function MedicalNumericOutputDisclaimer({
  className,
  compact,
}: {
  className?: string;
  /** Slightly tighter padding for dense layouts */
  compact?: boolean;
}) {
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
        Diabeaters is not a medical device. These numbers are not a prescription. Confirm any doses or treatment changes with
        your diabetes team. Seek emergency care for severe hypoglycaemia, DKA symptoms, or any emergency.
      </AlertDescription>
    </Alert>
  );
}
