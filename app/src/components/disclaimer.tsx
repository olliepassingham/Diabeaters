import { Shield } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const DISCLAIMER_TEXT =
  "Educational only — not medical advice. Follow your care team’s guidance.";

/** Reusable disclaimer for onboarding and Settings/About. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      {DISCLAIMER_TEXT}
    </p>
  );
}

/** Scenario hub tools: same copy as {@link Disclaimer}, in a compact alert-style callout. */
export function ScenarioToolDisclaimer({ className }: { className?: string }) {
  return (
    <Alert
      className={cn(
        "border-border/60 bg-muted/20 py-3 shadow-none sm:py-3.5",
        "[&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg]:text-muted-foreground [&>svg~*]:pl-7",
        className,
      )}
    >
      <Shield className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <AlertDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {DISCLAIMER_TEXT}
      </AlertDescription>
    </Alert>
  );
}
