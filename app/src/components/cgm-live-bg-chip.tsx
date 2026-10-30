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
  /** Render without outer bar chrome — for embedding inside the LIVE status bar. */
  embedded?: boolean;
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
  "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]";

/** Solid card fill so the chip reads clearly against the app canvas (esp. supporter mode). */
const barSurface = "border-border/70 bg-card text-foreground";

const embeddedBase = "flex min-w-0 flex-1 items-center gap-1.5";

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
  embedded = false,
  className,
}: CgmLiveBgChipProps) {
  const shell = embedded ? embeddedBase : barBase;

  if (loading && !prefill?.fromCgm) {
    return (
      <div
        className={cn(
          shell,
          !embedded && barSurface,
          embedded ? "text-[11px] text-muted-foreground" : "text-xs text-muted-foreground",
          className,
        )}
        role="status"
        aria-live="polite"
        data-testid="cgm-live-bg-chip-loading"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
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
        className={cn(shell, !embedded && barSurface, className)}
        role="status"
        aria-live="polite"
        data-testid="cgm-live-bg-chip-waiting"
      >
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              "min-w-0 flex-1 text-left text-muted-foreground",
              embedded ? "text-[11px]" : "text-xs",
            )}
            aria-label={openLabel}
            data-testid="button-cgm-live-chip-open"
          >
            {waitingLabel}
          </button>
        ) : (
          <span className={cn("text-muted-foreground", embedded ? "text-[11px]" : "text-xs")}>
            {waitingLabel}
          </span>
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
        {trailing}
      </div>
    );
  }

  const { reading } = prefill;
  const TrendIcon = trendIcon(reading.trend);
  const trend = trendLabel(reading.trend);
  const stale = reading.isStale;
  const resolvedRange: GlucoseRangeStatus | null = rangeStatus ?? null;
  const toneClass = embedded
    ? ""
    : resolvedRange
      ? glucoseRangeCardClasses(resolvedRange)
      : stale
        ? "border-amber-500/30 bg-amber-500/10 dark:border-amber-500/40 dark:bg-amber-950/40"
        : "border-emerald-500/25 bg-emerald-500/10 dark:border-emerald-500/35 dark:bg-emerald-950/30";

  const valueTone =
    resolvedRange === "low"
      ? "text-red-700 dark:text-red-300"
      : resolvedRange === "high"
        ? "text-orange-700 dark:text-orange-300"
        : resolvedRange === "in_range"
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-foreground";

  const body = (
    <>
      <span
        className={cn(
          "tabular-nums tracking-tight",
          embedded ? "text-xs font-semibold leading-none" : "text-sm font-semibold",
          valueTone,
        )}
      >
        {prefill.value}
        <span className={cn("ml-0.5 font-medium text-muted-foreground", embedded ? "text-[9px]" : "text-xs")}>
          {reading.units}
        </span>
      </span>
      {TrendIcon && trend ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] capitalize text-muted-foreground">
          <TrendIcon className={cn("shrink-0", embedded ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} aria-hidden />
          {embedded ? null : trend}
        </span>
      ) : null}
      {embedded ? (
        <span className="text-[9px] tabular-nums text-muted-foreground/80">
          {!Number.isFinite(reading.ageMinutes) || reading.ageMinutes < 1
            ? "now"
            : reading.ageMinutes < 60
              ? `${reading.ageMinutes}m`
              : `${Math.floor(reading.ageMinutes / 60)}h`}
        </span>
      ) : null}
      {resolvedRange && !embedded ? (
        <Badge
          variant="secondary"
          className="h-5 shrink-0 rounded-full border-0 bg-background/55 px-2 text-[10px] font-semibold"
        >
          {glucoseRangeStatusLabel(resolvedRange)}
        </Badge>
      ) : null}
      {!embedded ? (
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {formatAgeMinutes(reading.ageMinutes)} ago
          {reading.sourceLabel ? ` · ${reading.sourceLabel}` : ""}
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(shell, toneClass, className)}
      role="status"
      aria-live="polite"
      data-testid="cgm-live-bg-chip"
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex min-w-0 flex-1 items-center text-left",
            embedded ? "gap-x-1.5" : "flex-wrap gap-x-2 gap-y-0.5",
          )}
          aria-label={openLabel}
          data-testid="button-cgm-live-chip-open"
        >
          {body}
        </button>
      ) : (
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center",
            embedded ? "gap-x-1.5" : "flex-wrap gap-x-2 gap-y-0.5",
          )}
        >
          {body}
        </div>
      )}
      {onRefresh && !embedded ? (
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
