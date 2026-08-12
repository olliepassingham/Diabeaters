import * as React from "react";
import { Card, type CardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

/** Dashboard widget surface — glass family to match the home hero. */
export function WidgetCard({
  className,
  variant = "glass-strong",
  onPointerDown,
  ...props
}: React.ComponentProps<typeof Card> & { variant?: CardVariant }) {
  return (
    <Card
      variant={variant}
      className={cn(
        // Single hairline edge — the glass surface provides the fill; no ring/shadow stacking.
        "pressable card-interactive dashboard-card-hover flex flex-col overflow-hidden rounded-[1.35rem] border border-border/50 shadow-none dark:border-border/40",
        className,
      )}
      {...props}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        // Nested controls handle their own feedback — only haptic on the card chrome.
        if (target?.closest("button, a[href], input, textarea, select, [role='switch'], [role='checkbox'], [role='radio']")) {
          return;
        }
        void hapticLight();
      }}
    />
  );
}
