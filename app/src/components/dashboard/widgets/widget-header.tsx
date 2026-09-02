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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/12",
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
