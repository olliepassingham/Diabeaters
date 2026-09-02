import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact icon ring for dashboard widget headers. */
export function WidgetHeaderIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 shadow-[0_6px_18px_-8px_currentColor] ring-1 ring-primary/10",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-4 w-4 text-primary" />
    </div>
  );
}

export const widgetHeaderClass = "p-3 pb-2 md:p-4 md:pb-2";
export const widgetContentClass = "p-3 pt-0 md:px-4 md:pb-4";
