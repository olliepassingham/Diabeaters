import { AlertTriangle } from "lucide-react";
import type { ClinicalWarning } from "@/lib/clinical-validation";

interface ClinicalWarningHintProps {
  warning: ClinicalWarning | null;
}

export function ClinicalWarningHint({ warning }: ClinicalWarningHintProps) {
  if (!warning) return null;

  return (
    <p
      className="flex items-start gap-1.5 text-xs mt-1"
      style={{ color: "hsl(var(--warning-text))" }}
      data-testid="text-clinical-warning"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>{warning.message}</span>
    </p>
  );
}
