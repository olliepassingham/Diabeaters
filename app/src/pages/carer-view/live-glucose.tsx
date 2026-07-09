import { Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { useSupporterLiveBg } from "@/hooks/use-supporter-live-bg";
import { fetchLiveGlucoseForLinkedPatient } from "@/lib/carers";
import type { CloudPatientLiveGlucoseRow } from "@/lib/carers.types";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { glucoseRangeStatusLabel } from "@/lib/live-glucose-range";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

function trendIcon(trend: string | null | undefined) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  if (trend === "flat") return Minus;
  return null;
}

function rangeTone(status: CloudPatientLiveGlucoseRow["range_status"]) {
  if (status === "low") return "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100";
  if (status === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-950 dark:text-orange-100";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100";
}

export default function CarerLiveGlucosePage() {
  const { data: linkedPatient, loading: linkLoading } = useLinkedPatient();
  const scopeOn = linkedPatient?.scopes.live_glucose !== false;
  const patientId = linkedPatient?.patientId ?? null;
  const { prefill, loading, refresh } = useSupporterLiveBg(patientId, Boolean(patientId && scopeOn));
  const [row, setRow] = useState<CloudPatientLiveGlucoseRow | null>(null);

  const loadRow = useCallback(async () => {
    if (!patientId || !scopeOn) {
      setRow(null);
      return;
    }
    const { data } = await fetchLiveGlucoseForLinkedPatient(patientId);
    setRow(data);
  }, [patientId, scopeOn]);

  useEffect(() => {
    void loadRow();
  }, [loadRow, prefill]);

  const handleRefresh = () => {
    refresh();
    void loadRow();
  };

  const reading = prefill?.reading;
  const TrendIcon = trendIcon(reading?.trend ?? null);
  const rangeStatus = row?.range_status ?? "in_range";

  return (
    <PageShell variant="standard" density="compact" className="space-y-4" data-testid="carer-live-glucose-page">
      <PageHeader
        leading={<PageBackButton fallbackHref="/carer-view" />}
        title="Live glucose"
        description="Latest reading shared from their device — not a full CGM history."
      />

      {linkLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : !scopeOn ? (
        <Alert>
          <AlertDescription className="text-sm">
            They have turned off live glucose sharing in Family &amp; supporters.
          </AlertDescription>
        </Alert>
      ) : !reading ? (
        <Alert>
          <AlertDescription className="text-sm space-y-3">
            <p>No recent reading yet. Ask them to open Diabeaters with Dexcom Share or LibreLink Up connected.</p>
            <Button type="button" size="sm" variant="outline" onClick={handleRefresh} data-testid="button-carer-glucose-refresh">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card className={cn("overflow-hidden rounded-2xl border shadow-none", rangeTone(rangeStatus))}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium text-muted-foreground">Now</CardTitle>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-3xl font-semibold tabular-nums tracking-tight" data-testid="carer-live-glucose-value">
                    {prefill?.value}{" "}
                    <span className="text-lg font-medium text-muted-foreground">{reading.units}</span>
                  </p>
                  {TrendIcon && reading.trend ? (
                    <span className="inline-flex items-center gap-1 text-sm capitalize text-muted-foreground">
                      <TrendIcon className="h-4 w-4" aria-hidden />
                      {reading.trend}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {reading.sourceLabel} · {formatAgeMinutes(reading.ageMinutes)} ago
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleRefresh}
                disabled={loading}
                aria-label="Refresh glucose reading"
                data-testid="button-carer-glucose-refresh"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full border-0 bg-background/50">
                  {glucoseRangeStatusLabel(rangeStatus)}
                </Badge>
                {row?.target_low != null && row?.target_high != null ? (
                  <Badge variant="secondary" className="rounded-full border-0 bg-background/50 tabular-nums">
                    Target {formatTargetBgInput(row.target_low, row.units)}–{formatTargetBgInput(row.target_high, row.units)}{" "}
                    {row.units}
                  </Badge>
                ) : null}
              </div>
              {reading.stalenessNote ? (
                <p className="text-sm text-muted-foreground leading-snug">{reading.stalenessNote}</p>
              ) : null}
            </CardContent>
          </Card>

          <MedicalNumericOutputDisclaimer />
          <p className="text-xs text-muted-foreground leading-snug">
            Educational only — confirm on their CGM or meter before acting. Readings update when they use the app with
            CGM connected.
          </p>
        </>
      )}
    </PageShell>
  );
}
