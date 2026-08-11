import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { ExerciseBgTrend } from "@/lib/storage";

const TREND_OPTIONS: Array<{ value: "flat" | "rising" | "falling"; label: string; icon: typeof Minus }> = [
  { value: "flat", label: "Flat", icon: Minus },
  { value: "rising", label: "Rising", icon: TrendingUp },
  { value: "falling", label: "Falling", icon: TrendingDown },
];

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
  // One BG surface: the editable field is the source of truth. CGM chip was removed so
  // connected users don't see the same reading three times (chip + input + update button).
  return (
    <div className={className} data-testid="exercise-cgm-bg-field">
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">BG now</Label>
          <div className="relative">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              inputMode="decimal"
              value={bgValue}
              onChange={(e) => onBgChange(e.target.value)}
              placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
              className="h-14 w-full rounded-2xl border-border/60 bg-muted/20 pr-16 text-2xl font-semibold tabular-nums shadow-none"
              data-testid={inputTestId}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
              {bgUnits}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Trend</Label>
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/30 p-1">
            {TREND_OPTIONS.map((t) => {
              const Icon = t.icon;
              const active = trend === t.value;
              return (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-10 rounded-xl px-1.5 text-xs font-medium",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onTrendChange(active ? ("not_sure" as ExerciseBgTrend) : t.value)}
                  data-testid={`${trendTestIdPrefix}-${t.value}`}
                >
                  <Icon className="mr-1 h-3.5 w-3.5" aria-hidden />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2.5">
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
    </div>
  );
}
