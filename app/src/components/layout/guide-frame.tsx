import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Short accent under a guide title, then the steps on one light-mode panel. */
export function GuideFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="guide-intro-band" aria-hidden />
      <div className="guide-content-panel space-y-4">{children}</div>
    </div>
  );
}
