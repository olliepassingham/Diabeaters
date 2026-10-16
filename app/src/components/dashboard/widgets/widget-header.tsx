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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
    </div>
  );
}

/** Match home runway horizontal inset (main px-4 / md:px-6). */
export const widgetHeaderClass = "px-4 pb-1.5 pt-2 md:px-6";
export const widgetContentClass = "px-4 pb-2.5 pt-0 md:px-6";
