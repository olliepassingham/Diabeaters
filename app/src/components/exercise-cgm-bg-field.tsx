import { TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CgmLiveBgChip } from "@/components/cgm-live-bg-chip";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { ExerciseBgTrend } from "@/lib/storage";

type ExerciseCgmBgFieldProps = {
  bgUnits: string;
  bgValue: string;
  trend: ExerciseBgTrend | null | undefined;
  onBgChange: (value: string) => void;
  onTrendChange: (trend: ExerciseBgTrend) => void;
  prefill: BgPrefillResult | null;
  loading?: boolean;
  onRefresh?: () => void;
  emptyHint?: string;
  inputTestId?: string;
  trendTestIdPrefix?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
};

export function ExerciseCgmBgField({
  bgUnits,
  bgValue,
  trend,
  onBgChange,
  onTrendChange,
  prefill,
  loading,
  onRefresh,
  emptyHint,
  inputTestId = "input-exercise-bg",
  trendTestIdPrefix = "button-exercise-trend",
  inputRef,
  className,
}: ExerciseCgmBgFieldProps) {
  const showLiveChip = Boolean(prefill?.fromCgm);

  return (
    <div className={className} data-testid="exercise-cgm-bg-field">
      {showLiveChip ? (
        <CgmLiveBgChip prefill={prefill} loading={loading} onRefresh={onRefresh} className="mb-2" />
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">BG now</Label>
          <Label className="text-xs text-muted-foreground">Trend</Label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            inputMode="decimal"
            value={bgValue}
            onChange={(e) => onBgChange(e.target.value)}
            placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
            className="h-9 min-w-[10rem] flex-1"
            data-testid={inputTestId}
          />
          <div className="flex flex-wrap gap-2">
            {(["flat", "rising", "falling"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={trend === t ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => onTrendChange(trend === t ? ("not_sure" as ExerciseBgTrend) : t)}
                data-testid={`${trendTestIdPrefix}-${t}`}
              >
                {t === "rising" ? <TrendingUp className="h-3.5 w-3.5 mr-1" aria-hidden /> : null}
                {t === "falling" ? <TrendingDown className="h-3.5 w-3.5 mr-1" aria-hidden /> : null}
                {t}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <CgmPrefillButton
        prefill={prefill}
        loading={loading}
        bgUnits={bgUnits}
        currentValue={bgValue}
        onApply={onBgChange}
        onApplyTrend={onTrendChange}
        onRefresh={onRefresh}
        emptyHint={emptyHint}
        allowSync
        testId="button-exercise-cgm-prefill"
      />
    </div>
  );
}
