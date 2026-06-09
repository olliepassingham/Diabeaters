import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GradientMarkerBarProps = {
  /** 0 = left end, 1 = right end */
  markerPosition: number;
  /** Muted labels under the track */
  endLeftLabel?: string;
  endRightLabel?: string;
  /** Tailwind classes for the horizontal gradient track */
  trackGradientClassName?: string;
  /** Optional row above the track (e.g. title + value) */
  header?: ReactNode;
  /** Small print under end labels */
  footer?: ReactNode;
  /** When false, only the gradient track and marker are shown */
  showEndLabels?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Horizontal gradient track with a vertical marker — same visual language as meal absorption pace
 * ([MealCarbAbsorptionPreview](@/components/meal-carb-absorption-preview.tsx)).
 */
export function GradientMarkerBar({
  markerPosition,
  endLeftLabel = "Fast",
  endRightLabel = "Slow",
  trackGradientClassName = "from-sky-950 via-sky-600 to-sky-300 dark:from-sky-950 dark:via-sky-600 dark:to-sky-200",
  header,
  footer,
  showEndLabels = true,
  className,
  "data-testid": testId,
}: GradientMarkerBarProps) {
  const p = Math.min(0.97, Math.max(0.03, markerPosition));

  return (
    <div className={cn("space-y-2.5", className)} data-testid={testId}>
      {header ? <div className="flex items-baseline justify-between gap-2">{header}</div> : null}
      <div className="relative h-2.5">
        <div
          className={cn("absolute inset-0 rounded-full bg-gradient-to-r", trackGradientClassName)}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 z-10 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
          style={{ left: `${p * 100}%` }}
          aria-hidden
        />
      </div>
      {showEndLabels ? (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{endLeftLabel}</span>
          <span>{endRightLabel}</span>
        </div>
      ) : null}
      {footer ? <div className="text-[10px] leading-snug text-muted-foreground/90">{footer}</div> : null}
    </div>
  );
}
