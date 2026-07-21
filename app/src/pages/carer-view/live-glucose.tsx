import { Link } from "wouter";
import { Droplet, Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { SupporterHypoCheckInButton } from "@/components/supporter-hypo-check-in-section";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { useSupporterLiveBg } from "@/hooks/use-supporter-live-bg";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { formatTargetBgInput } from "@/lib/hypo-context";
import {
  glucoseRangeCardClasses,
  glucoseRangeStatusLabel,
  glucoseRangeValueClasses,
  type GlucoseRangeStatus,
} from "@/lib/live-glucose-range";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import {
  mmolToDisplayBg,
  resolveSupporterLiveGlucoseAlertLimitsMmol,
} from "@/lib/supporter-live-glucose-alerts";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";

function trendIcon(trend: string | null | undefined) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  if (trend === "flat") return Minus;
  return null;
}

export default function CarerLiveGlucosePage() {
  const { data: linkedPatient, loading: linkLoading } = useLinkedPatient();
  const scopeOn = linkedPatient?.scopes.live_glucose !== false;
  const patientId = linkedPatient?.patientId ?? null;
  const { prefill, row, loading, refresh } = useSupporterLiveBg(patientId, Boolean(patientId && scopeOn));

  const reading = prefill?.reading;
  const rangeStatus: GlucoseRangeStatus = row?.range_status ?? "in_range";
  const TrendIcon = trendIcon(reading?.trend ?? null);
  const isLow = rangeStatus === "low";
  const bgUnits = normalizeBgUnits(storage.getProfile()?.bgUnits);
  const alertLimits = resolveSupporterLiveGlucoseAlertLimitsMmol(storage.getNotificationSettings());
  const alertLowDisplay = mmolToDisplayBg(alertLimits.low, bgUnits);
  const alertHighDisplay = mmolToDisplayBg(alertLimits.high, bgUnits);
  const patientName = linkedPatient?.patient_full_name?.trim() || null;

  return (
    <PageShell variant="standard" density="compact" className="space-y-4" data-testid="carer-live-glucose-page">
      <PageHeader
        leading={<PageBackButton fallbackHref="/carer-view" />}
        title="Live glucose"
        description={patientName ? `Supporting ${patientName}` : undefined}
      />

      {linkLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : !scopeOn ? (
        <Card className="rounded-2xl border-border/60 shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground leading-relaxed">
            They have turned off live glucose sharing in Family &amp; supporters.
          </CardContent>
        </Card>
      ) : (
        <Card
          className={cn(
            "overflow-hidden rounded-2xl shadow-none",
            reading ? glucoseRangeCardClasses(rangeStatus) : "border-border/60",
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-medium text-muted-foreground">Now</CardTitle>
                {reading ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full border-0 bg-background/60 text-xs font-medium"
                  >
                    {glucoseRangeStatusLabel(rangeStatus)}
                  </Badge>
                ) : null}
              </div>

              {loading && !reading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : reading ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p
                    className={cn(
                      "text-3xl font-semibold tabular-nums tracking-tight",
                      glucoseRangeValueClasses(rangeStatus),
                    )}
                    data-testid="carer-live-glucose-value"
                  >
                    {prefill?.value}{" "}
                    <span className="text-lg font-medium text-muted-foreground">{reading.units}</span>
                  </p>
                  {TrendIcon && reading.trend ? (
                    <span className="inline-flex items-center gap-1 text-sm capitalize text-muted-foreground">
                      <TrendIcon className="h-4 w-4" aria-hidden />
                      {reading.trend}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {reading.sourceLabel} · {formatAgeMinutes(reading.ageMinutes)} ago
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recent reading. Ask them to open Diabeaters with CGM connected.
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh glucose reading"
              data-testid="button-carer-glucose-refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {reading ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {row?.target_low != null && row?.target_high != null
                  ? `Target ${formatTargetBgInput(row.target_low, row.units)}–${formatTargetBgInput(row.target_high, row.units)} ${row.units}`
                  : "Target range not included with this reading"}
                {reading.stalenessNote ? ` · ${reading.stalenessNote}` : ""}
              </p>
            ) : null}

            {patientId ? (
              <SupporterHypoCheckInButton
                patientId={patientId}
                patientName={patientName ?? "them"}
                prominence="primary"
              />
            ) : null}

            {isLow ? (
              <Button asChild className="h-11 w-full rounded-xl" data-testid="link-carer-glucose-hypo-help">
                <Link href="/tools/hypo-help">
                  <Droplet className="mr-2 h-4 w-4" aria-hidden />
                  Hypo help
                </Link>
              </Button>
            ) : reading ? (
              <Button
                asChild
                variant="outline"
                className="h-10 w-full rounded-xl"
                data-testid="link-carer-glucose-hypo-help"
              >
                <Link href="/tools/hypo-help">
                  <Droplet className="mr-2 h-4 w-4" aria-hidden />
                  Hypo help
                </Link>
              </Button>
            ) : null}

            <div className="space-y-2 border-t border-border/40 pt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Confirm on their CGM or meter before acting.
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Check-in alerts</span>
                  <span className="mx-1.5 text-border">·</span>
                  <span className="tabular-nums">
                    Below {alertLowDisplay} · above {alertHighDisplay} {bgUnits}
                  </span>
                </p>
                <Link
                  href="/settings/notifications"
                  className="shrink-0 text-xs font-medium text-primary hover:underline underline-offset-2"
                  data-testid="link-carer-glucose-alert-limits"
                >
                  Edit
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
