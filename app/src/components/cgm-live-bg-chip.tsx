import type { ReactNode } from "react";
import { Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { ExerciseBgTrend } from "@/lib/storage";
import {
  glucoseRangeCardClasses,
  glucoseRangeStatusLabel,
  type GlucoseRangeStatus,
} from "@/lib/live-glucose-range";
import { formatAgeMinutes } from "@/lib/cgm/staleness";

type CgmLiveBgChipProps = {
  prefill: BgPrefillResult | null;
  loading?: boolean;
  onRefresh?: () => void;
  /** Navigate when the chip body is tapped. */
  onOpen?: () => void;
  /** Accessible label for the open control. */
  openLabel?: string;
  /**
   * When true and there is no reading yet, show a muted waiting chip instead of hiding.
   * Used for supporter mode while live glucose sharing is on.
   */
  showWaiting?: boolean;
  waitingLabel?: string;
  /** Optional range status for colouring (supporter live snapshot). */
  rangeStatus?: GlucoseRangeStatus | null;
  /** Extra controls on the same bar (e.g. compact Travel) so chrome stays one row. */
  trailing?: ReactNode;
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

const barBase =
  "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 backdrop-blur [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]";

export function CgmLiveBgChip({
  prefill,
  loading,
  onRefresh,
  onOpen,
  openLabel = "Open live glucose",
  showWaiting = false,
  waitingLabel = "Waiting for live BG",
  rangeStatus = null,
  trailing = null,
  className,
}: CgmLiveBgChipProps) {
  if (loading && !prefill?.fromCgm) {
    return (
      <div
        className={cn(barBase, "border-border/60 bg-background/55 text-xs text-muted-foreground", className)}
        role="status"
        aria-live="polite"
        data-testid="cgm-live-bg-chip-loading"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          Checking BG…
        </div>
        {trailing}
      </div>
    );
  }

  if (!prefill?.fromCgm || !prefill.reading) {
    if (!showWaiting) return null;
    return (
      <div
        className={cn(barBase, "border-border/60 bg-background/55", className)}
        role="status"
        aria-live="polite"
        data-testid="cgm-live-bg-chip-waiting"
      >
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left text-xs text-muted-foreground"
            aria-label={openLabel}
            data-testid="button-cgm-live-chip-open"
          >
            {waitingLabel}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">{waitingLabel}</span>
        )}
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 -my-1"
            onClick={onRefresh}
            aria-label="Refresh glucose reading"
            data-testid="button-cgm-live-refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
        {trailing}
      </div>
    );
  }

  const { reading } = prefill;
  const TrendIcon = trendIcon(reading.trend);
  const trend = trendLabel(reading.trend);
  const stale = reading.isStale;
  const resolvedRange: GlucoseRangeStatus | null = rangeStatus ?? null;
  const toneClass = resolvedRange
    ? glucoseRangeCardClasses(resolvedRange)
    : stale
      ? "border-amber-500/30 bg-amber-500/10 dark:border-amber-500/40 dark:bg-amber-950/40"
      : "border-emerald-500/25 bg-emerald-500/10 dark:border-emerald-500/35 dark:bg-emerald-950/30";

  const body = (
    <>
      <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
        {prefill.value}{" "}
        <span className="text-xs font-medium text-muted-foreground">{reading.units}</span>
      </span>
      {TrendIcon && trend ? (
        <span className="inline-flex items-center gap-0.5 text-[11px] capitalize text-muted-foreground">
          <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {trend}
        </span>
      ) : null}
      {resolvedRange ? (
        <Badge
          variant="secondary"
          className="h-5 shrink-0 rounded-full border-0 bg-background/55 px-2 text-[10px] font-semibold"
        >
          {glucoseRangeStatusLabel(resolvedRange)}
        </Badge>
      ) : null}
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
        {formatAgeMinutes(reading.ageMinutes)} ago
        {reading.sourceLabel ? ` · ${reading.sourceLabel}` : ""}
      </span>
    </>
  );

  return (
    <div
      className={cn(barBase, toneClass, className)}
      role="status"
      aria-live="polite"
      data-testid="cgm-live-bg-chip"
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left"
          aria-label={openLabel}
          data-testid="button-cgm-live-chip-open"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">{body}</div>
      )}
      {onRefresh ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 -my-1"
          onClick={onRefresh}
          aria-label="Refresh glucose reading"
          data-testid="button-cgm-live-refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
      {trailing}
    </div>
  );
}
