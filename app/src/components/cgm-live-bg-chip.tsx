import { Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { ExerciseBgTrend } from "@/lib/storage";

type CgmLiveBgChipProps = {
  prefill: BgPrefillResult | null;
  loading?: boolean;
  onRefresh?: () => void;
  /** Navigate to glucose trend page (chip body tap). */
  onOpen?: () => void;
  className?: string;
};

function trendIcon(trend: ExerciseBgTrend | null | undefined) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  if (trend === "flat") return Minus;
  return null;
}

function trendLabel(trend: ExerciseBgTrend | null | undefined): string | null {
  if (trend === "rising") return "rising";
  if (trend === "falling") return "falling";
  if (trend === "flat") return "flat";
  return null;
}

export function CgmLiveBgChip({ prefill, loading, onRefresh, onOpen, className }: CgmLiveBgChipProps) {
  if (loading && !prefill?.fromCgm) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
        role="status"
        aria-live="polite"
        data-testid="cgm-live-bg-chip-loading"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        Checking BG…
      </div>
    );
  }

  if (!prefill?.fromCgm || !prefill.reading) return null;

  const { reading } = prefill;
  const TrendIcon = trendIcon(reading.trend);
  const trend = trendLabel(reading.trend);
  const stale = reading.isStale;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
        stale
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-emerald-500/25 bg-emerald-500/10",
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid="cgm-live-bg-chip"
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left"
          aria-label="Open glucose trend chart"
          data-testid="button-cgm-live-chip-open"
        >
          <Badge
            variant="secondary"
            className={cn(
              "h-6 shrink-0 rounded-full border-0 px-2 text-xs font-semibold tabular-nums",
              stale ? "bg-amber-500/20 text-amber-950 dark:text-amber-100" : "bg-emerald-500/20 text-emerald-950 dark:text-emerald-100",
            )}
          >
            {prefill.value} {reading.units}
          </Badge>
          <span className="text-[11px] text-muted-foreground truncate">{prefill.source}</span>
          {TrendIcon && trend ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground capitalize">
              <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
              {trend}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Badge
            variant="secondary"
            className={cn(
              "h-6 shrink-0 rounded-full border-0 px-2 text-xs font-semibold tabular-nums",
              stale ? "bg-amber-500/20 text-amber-950 dark:text-amber-100" : "bg-emerald-500/20 text-emerald-950 dark:text-emerald-100",
            )}
          >
            {prefill.value} {reading.units}
          </Badge>
          <span className="text-[11px] text-muted-foreground truncate">{prefill.source}</span>
          {TrendIcon && trend ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground capitalize">
              <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
              {trend}
            </span>
          ) : null}
        </div>
      )}
      {onRefresh ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onRefresh}
          aria-label="Refresh glucose reading"
          data-testid="button-cgm-live-refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
