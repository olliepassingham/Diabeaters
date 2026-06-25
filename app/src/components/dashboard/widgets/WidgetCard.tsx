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
        "pressable card-interactive dashboard-card-hover flex flex-col overflow-hidden rounded-2xl border border-border/55 shadow-sm ring-1 ring-border/20 dark:border-border/45",
        variant === "glass-muted" && "ring-0",
        className,
      )}
      {...props}
    />
  );
}
