import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Short accent under a guide title, then the steps on one light-mode panel. */
export function GuideFrame({
  children,
  className,
  bare = false,
}: {
  children: ReactNode;
  className?: string;
  /** Keep the accent line and skip the padded panel when the children are already cards. */
  bare?: boolean;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="guide-intro-band" aria-hidden />
      <div className={cn("space-y-4", !bare && "guide-content-panel")}>{children}</div>
    </div>
  );
}
