import * as React from "react";
import { Card, type CardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import type { WidgetAccent } from "@/config/dashboard-widgets";

const ACCENT_CLASS: Record<WidgetAccent, string> = {
  insights: "widget-accent-insights",
  tracking: "widget-accent-tracking",
  community: "widget-accent-community",
  setup: "widget-accent-setup",
  urgent: "widget-accent-urgent",
  default: "",
};

/** Dashboard widget section — intentionally borderless on the continuous home canvas. */
export function WidgetCard({
  className,
  variant = "glass-strong",
  accent = "default",
  onPointerDown,
  ...props
}: React.ComponentProps<typeof Card> & { variant?: CardVariant; accent?: WidgetAccent }) {
  return (
    <Card
      variant={variant}
      className={cn(
        "pressable flex flex-col overflow-hidden !rounded-none !border-0 !bg-none !bg-transparent !shadow-none !ring-0 !backdrop-blur-none",
        ACCENT_CLASS[accent],
        className,
      )}
      {...props}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest("button, a[href], input, textarea, select, [role='switch'], [role='checkbox'], [role='radio']")) {
          return;
        }
        void hapticLight();
      }}
    />
  );
}
