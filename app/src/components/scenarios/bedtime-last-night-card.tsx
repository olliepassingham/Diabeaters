import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Moon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CgmGlucoseChart } from "@/components/cgm-glucose-chart";
import type { BedtimeLastNightStatus } from "@/hooks/use-bedtime-last-night";
import type { BedtimeOvernightInsight } from "@/lib/bedtime-overnight-analysis";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { cn } from "@/lib/utils";

type BedtimeLastNightCardProps = {
  insight: BedtimeOvernightInsight | null;
  status: BedtimeLastNightStatus;
  message?: string | null;
  usedCalendarFallback?: boolean;
  units: BgUnits;
  targetLow?: number;
  targetHigh?: number;
  onRefresh?: () => void;
  className?: string;
};

function overnightChartPoints(insight: BedtimeOvernightInsight): CgmChartPoint[] {
  return insight.readings.map((r) => ({
    recordedAt: r.recordedAt,
    timeMs: r.timeMs,
    timeLabel: new Date(r.timeMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    value: r.value,
    trend: null,
  }));
}

function toneForHeadline(headline: string) {
  if (/low/i.test(headline)) {
    return "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card dark:from-amber-950/35";
  }
  if (/high|mixed|rose/i.test(headline)) {
    return "border-orange-500/30 bg-gradient-to-br from-orange-500/8 via-card to-card dark:from-orange-950/30";
  }
  return "border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-card to-card dark:from-emerald-950/30";
}

function collapsedPreview(
  insight: BedtimeOvernightInsight | null,
  status: BedtimeLastNightStatus,
  message: string | null | undefined,
  targetLow: number | undefined,
  targetHigh: number | undefined,
  units: BgUnits,
): string {
  if (status === "loading") return "Loading overnight readings…";
  if (message) return message;
  if (insight) {
    const range =
      targetLow != null && targetHigh != null
        ? `${formatTargetBgInput(targetLow, units)}–${formatTargetBgInput(targetHigh, units)}`
        : `${formatTargetBgInput(insight.targetLow, units)}–${formatTargetBgInput(insight.targetHigh, units)}`;
    return `${insight.headline} · ${insight.stats.inRangePercent}% in target (${range})`;
  }
  return "Tap to review overnight glucose";
}

function HeaderActions({
  showRefresh,
  showChevron,
  open,
  loading,
  onRefresh,
}: {
  showRefresh: boolean;
  showChevron: boolean;
  open: boolean;
  loading: boolean;
  onRefresh?: () => void;
}) {
  if (!showRefresh && !showChevron) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {showRefresh && onRefresh ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          disabled={loading}
          aria-label="Refresh last night review"
          data-testid="button-bedtime-last-night-refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
        </Button>
      ) : null}
      {showChevron ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </span>
      ) : null}
    </div>
  );
}

function InsightBody({
  insight,
  usedCalendarFallback,
  units,
  chartTargetLow,
  chartTargetHigh,
}: {
  insight: BedtimeOvernightInsight;
  usedCalendarFallback?: boolean;
  units: BgUnits;
  chartTargetLow: number | undefined;
  chartTargetHigh: number | undefined;
}) {
  return (
    <>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground" data-testid="text-bedtime-last-night-headline">
          {insight.headline}
        </p>
        <p className="text-sm leading-snug text-foreground/90">{insight.summary}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted/60 px-2 py-0.5 tabular-nums">
          Target {formatTargetBgInput(chartTargetLow!, units)}–{formatTargetBgInput(chartTargetHigh!, units)}
        </span>
        <span className="rounded-full bg-muted/60 px-2 py-0.5 tabular-nums">
          Lowest {formatTargetBgInput(insight.stats.min, units)}
        </span>
        <span className="rounded-full bg-muted/60 px-2 py-0.5 tabular-nums">
          Highest {formatTargetBgInput(insight.stats.max, units)}
        </span>
        <span className="rounded-full bg-muted/60 px-2 py-0.5 tabular-nums">
          {insight.stats.inRangePercent}% in target
        </span>
      </div>

      {insight.readings.length > 1 ? (
        <CgmGlucoseChart
          points={overnightChartPoints(insight)}
          units={units}
          targetLow={chartTargetLow}
          targetHigh={chartTargetHigh}
        />
      ) : null}

      {insight.explanations.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-foreground/90" data-testid="list-bedtime-last-night-explanations">
          {insight.explanations.map((line) => (
            <li key={line} className="flex gap-2 leading-snug">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {insight.considerations.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Things to consider
          </p>
          <ul className="space-y-1.5 text-sm text-foreground/90" data-testid="list-bedtime-last-night-considerations">
            {insight.considerations.map((line) => (
              <li key={line} className="flex gap-2 leading-snug">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] leading-snug text-muted-foreground">
        Based on your connected CGM{usedCalendarFallback ? "" : " and your bedtime check inputs"} — educational only.
        Confirm on your CGM or receiver before changing treatment.
      </p>
    </>
  );
}

export function BedtimeLastNightCard({
  insight,
  status,
  message,
  usedCalendarFallback,
  units,
  targetLow,
  targetHigh,
  onRefresh,
  className,
}: BedtimeLastNightCardProps) {
  const [open, setOpen] = useState(false);
  const loading = status === "loading";
  const chartTargetLow = insight?.targetLow ?? targetLow;
  const chartTargetHigh = insight?.targetHigh ?? targetHigh;
  const preview = collapsedPreview(insight, status, message, chartTargetLow, chartTargetHigh, units);
  const canExpand = insight != null;
  const showRefresh = Boolean(onRefresh) && status !== "no_cgm";

  const cardClassName = cn(
    "overflow-hidden rounded-2xl border shadow-none",
    insight ? toneForHeadline(insight.headline) : "border-border/60 bg-card",
    className,
  );

  const titleBlock = (
    <>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
        aria-hidden
      >
        <Moon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-base font-semibold tracking-tight text-foreground">Last night</span>
        {insight && open ? (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {usedCalendarFallback ? "Estimated overnight · " : "From your bedtime check · "}
            {insight.sleepWindowLabel}
          </span>
        ) : (
          <span
            className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground"
            data-testid="text-bedtime-last-night-preview"
          >
            {preview}
          </span>
        )}
      </div>
    </>
  );

  if (!canExpand) {
    return (
      <Card className={cardClassName} data-testid="card-bedtime-last-night">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
          {titleBlock}
          <HeaderActions
            showRefresh={showRefresh}
            showChevron={false}
            open={false}
            loading={loading}
            onRefresh={onRefresh}
          />
        </div>
      </Card>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cardClassName} data-testid="card-bedtime-last-night">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left transition-colors hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={open ? "Collapse last night review" : "Expand last night review"}
            data-testid="button-bedtime-last-night-toggle"
          >
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
              {titleBlock}
              <HeaderActions
                showRefresh={showRefresh}
                showChevron
                open={open}
                loading={loading}
                onRefresh={onRefresh}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3 sm:px-5">
            {loading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading overnight readings…
              </div>
            ) : null}

            {message && !loading ? (
              <p className="text-sm leading-snug text-muted-foreground" role="status" data-testid="text-bedtime-last-night-error">
                {message}
              </p>
            ) : null}

            {insight && !loading ? (
              <InsightBody
                insight={insight}
                usedCalendarFallback={usedCalendarFallback}
                units={units}
                chartTargetLow={chartTargetLow}
                chartTargetHigh={chartTargetHigh}
              />
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
