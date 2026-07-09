import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import type { ExerciseBgTrend } from "@/lib/storage";

type CgmPrefillButtonProps = {
  prefill: BgPrefillResult | null;
  loading?: boolean;
  bgUnits: string;
  currentValue: string;
  onApply: (value: string) => void;
  /** When the CGM reading includes a trend, apply it alongside the value. */
  onApplyTrend?: (trend: ExerciseBgTrend) => void;
  onRefresh?: () => void;
  /** Shown after a completed check when no recent reading is available. */
  emptyHint?: string;
  /** When the field already has a value, still offer updating from the latest CGM reading. */
  allowSync?: boolean;
  testId?: string;
};

function applyPrefill(
  prefill: BgPrefillResult,
  onApply: (value: string) => void,
  onApplyTrend?: (trend: ExerciseBgTrend) => void,
) {
  onApply(prefill.value);
  const trend = cgmTrendForExercise(prefill.reading?.trend);
  if (trend && onApplyTrend) onApplyTrend(trend);
}

export function CgmPrefillButton({
  prefill,
  loading,
  bgUnits,
  currentValue,
  onApply,
  onApplyTrend,
  onRefresh,
  emptyHint,
  allowSync,
  testId = "button-cgm-prefill",
}: CgmPrefillButtonProps) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Looking up recent BG…
      </span>
    );
  }

  if (currentValue.trim()) {
    if (!allowSync || !prefill) return null;
    return (
      <div className="space-y-1 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => applyPrefill(prefill, onApply, onApplyTrend)}
          data-testid={`${testId}-sync`}
        >
          Update from CGM ({prefill.value} {bgUnits})
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">{prefill.source}</p>
      </div>
    );
  }

  if (!prefill) {
    if (!emptyHint) return null;
    return (
      <div className="space-y-1">
        <p className="text-[11px] leading-snug text-muted-foreground">{emptyHint}</p>
        {onRefresh ? (
          <button
            type="button"
            className="text-[11px] text-primary underline-offset-2 hover:underline"
            onClick={onRefresh}
          >
            Check again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => applyPrefill(prefill, onApply, onApplyTrend)}
        data-testid={testId}
      >
        Use recent ({prefill.value} {bgUnits})
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground">{prefill.source}</p>
      {onRefresh ? (
        <button
          type="button"
          className="text-[11px] text-primary underline-offset-2 hover:underline"
          onClick={onRefresh}
        >
          Refresh
        </button>
      ) : null}
    </div>
  );
}
