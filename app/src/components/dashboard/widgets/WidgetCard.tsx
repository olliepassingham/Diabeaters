import * as React from "react";
import { Card, type CardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Dashboard widget surface — glass family to match the home hero. */
export function WidgetCard({
  className,
  variant = "glass-strong",
  ...props
}: React.ComponentProps<typeof Card> & { variant?: CardVariant }) {
  return (
    <Card
      variant={variant}
      className={cn(
        // Single hairline edge — the glass surface provides the fill; no ring/shadow stacking.
        "pressable card-interactive dashboard-card-hover flex flex-col overflow-hidden rounded-2xl border border-border/50 shadow-none dark:border-border/40",
        className,
      )}
      {...props}
    />
  );
}
