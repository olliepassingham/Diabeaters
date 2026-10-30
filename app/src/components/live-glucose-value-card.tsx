import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  glucoseRangeCardClasses,
  type GlucoseRangeStatus,
} from "@/lib/live-glucose-range";

type LiveGlucoseValueCardProps = {
  rangeStatus?: GlucoseRangeStatus | null;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Full-bleed live BG hero. Avoids overflow-hidden + tight leading so display
 * numerals are not clipped at the top of the card.
 */
export function LiveGlucoseValueCard({
  rangeStatus = null,
  children,
  className,
  "data-testid": testId,
}: LiveGlucoseValueCardProps) {
  return (
    <section
      data-testid={testId}
      className={cn(
        // Break out of PageShell / main horizontal inset for edge-to-edge width.
        "relative -mx-4 w-[calc(100%+2rem)] border px-4 py-4 shadow-none md:-mx-6 md:w-[calc(100%+3rem)] md:px-6 md:py-5",
        "rounded-none border-x-0 sm:rounded-[1.35rem] sm:border-x",
        rangeStatus ? glucoseRangeCardClasses(rangeStatus) : "border-border/60 bg-card",
        className,
      )}
    >
      {children}
    </section>
  );
}
