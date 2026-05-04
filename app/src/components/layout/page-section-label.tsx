import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small uppercase eyebrow for grouping content below a `PageHeader` (dashboard sections, hubs). */
export function PageSectionLabel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <p
      id={id}
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
