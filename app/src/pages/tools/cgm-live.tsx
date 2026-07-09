import { useState } from "react";
import { Link } from "wouter";
import { Activity, Loader2, Minus, RefreshCw, Settings2, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CgmGlucoseChart } from "@/components/cgm-glucose-chart";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { liveCgmConnectMessage } from "@/lib/cgm/live-cgm-source";
import { CGM_HISTORY_RANGES, type CgmHistoryRange } from "@/lib/cgm/cgm-chart";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { useCgmHistory } from "@/hooks/use-cgm-history";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";

function trendIcon(trend: string | null | undefined) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  if (trend === "flat") return Minus;
  return null;
}

export default function CgmLivePage() {
  const [range, setRange] = useState<CgmHistoryRange>("12h");
  const { points, units, loading, error, connected, sourceLabel, refresh } = useCgmHistory(range);
  const settings = storage.getSettings();

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const targetLow = settings?.targetBgLow;
  const targetHigh = settings?.targetBgHigh;
  const TrendIcon = trendIcon(latest?.trend ?? null);

  return (
    <PageShell variant="standard" density="compact" className="space-y-4" data-testid="cgm-live-page">
      <PageHeader
        leading={<PageBackButton />}
        title="Glucose trends"
        description="Near-live CGM readings on this device only — not stored in the cloud."
      />

      {!connected ? (
        <Alert>
          <AlertDescription className="text-sm space-y-3">
            <p>{liveCgmConnectMessage()}</p>
            <Button asChild size="sm" data-testid="button-cgm-live-open-settings">
              <Link href="/settings/cgm">
                <Settings2 className="mr-2 h-4 w-4" aria-hidden />
                Open CGM settings
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium text-muted-foreground">Now</CardTitle>
            {loading && !latest ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : latest ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-3xl font-semibold tabular-nums tracking-tight" data-testid="cgm-live-current-value">
                  {formatTargetBgInput(latest.value, units)}{" "}
                  <span className="text-lg font-medium text-muted-foreground">{units}</span>
                </p>
                {TrendIcon && latest.trend ? (
                  <span className="inline-flex items-center gap-1 text-sm capitalize text-muted-foreground">
                    <TrendIcon className="h-4 w-4" aria-hidden />
                    {latest.trend}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {sourceLabel ?? "CGM"} · {formatAgeMinutes(Math.max(0, Math.floor((Date.now() - latest.timeMs) / 60_000)))} ago
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent reading</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={refresh}
            disabled={loading || !connected}
            aria-label="Refresh glucose chart"
            data-testid="button-cgm-live-refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chart time range">
            {CGM_HISTORY_RANGES.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={range === option.id ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setRange(option.id)}
                data-testid={`button-cgm-range-${option.id}`}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {points.length > 0 ? (
            <CgmGlucoseChart
              points={points}
              units={units}
              targetLow={typeof targetLow === "number" ? targetLow : undefined}
              targetHigh={typeof targetHigh === "number" ? targetHigh : undefined}
            />
          ) : loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Loading chart…
            </div>
          ) : null}

          {typeof targetLow === "number" && typeof targetHigh === "number" ? (
            <p className="text-[11px] text-muted-foreground">
              Dashed lines: your saved target range ({formatTargetBgInput(targetLow, units)}–
              {formatTargetBgInput(targetHigh, units)} {units}).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          For awareness only — always confirm on your CGM app or reader before treating a low or high. Readings stay
          on this device; Diabeaters does not upload CGM data to the cloud.
        </p>
      </div>

      <MedicalNumericOutputDisclaimer compact collapsible />
    </PageShell>
  );
}
