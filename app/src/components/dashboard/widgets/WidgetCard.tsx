import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Dashboard widget surface: matches design system (rounded-xl, shadow-sm, white). */
export function WidgetCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "pressable card-interactive h-full flex flex-col overflow-hidden rounded-xl border border-border/70 shadow-sm dark:border-border/50",
        className
      )}
      {...props}
    />
  );
}
