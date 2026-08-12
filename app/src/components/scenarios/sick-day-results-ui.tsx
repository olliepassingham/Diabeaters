import { AlertCircle, Activity, ChevronDown, Clock, Droplets, Syringe, Thermometer } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Disclaimer } from "@/components/disclaimer";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { cn } from "@/lib/utils";

export type KetoneLevel = "none" | "trace" | "small" | "moderate" | "large";

export type SickDayResultsViewModel = {
  correctionDose: number;
  correctionExplanation: string;
  baseCorrectionDose: number;
  severityModifier: number;
  bgZoneModifier: number;
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  snackRatio: string;
  originalBreakfastRatio: string;
  originalLunchRatio: string;
  originalDinnerRatio: string;
  originalSnackRatio: string;
  ratioMultiplier: number;
  basalAdjustment: string;
  basalAdjustmentBrief?: string;
  hydrationNote: string;
  hydrationBrief?: string;
  monitoringFrequency: string;
  monitoringBrief?: string;
  ketoneWarning: string;
  ketoneWarningBrief?: string;
  ketoneGuidance: string;
  ketoneGuidanceBrief?: string;
  ketoneActionRequired: "none" | "monitor" | "urgent" | "emergency";
  stackingWarning: string;
  stackingWarningBrief?: string;
};

export type SickDayVerdictViewModel = {
  label: string;
  tone: "critical" | "caution" | "ok";
  title: string;
  message: string;
};

export function scrollToSickDayPageTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.getElementById("sickday-page-top")?.focus({ preventScroll: true });
  });
}

export function SickDayDisclaimerFooter({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1 pt-1", className)} data-testid="sickday-disclaimer-footer">
      <Disclaimer className="text-center text-[11px] leading-relaxed opacity-80" />
      <MedicalSourcesLink anchor="sickday" compact className="text-center" />
    </div>
  );
}

function formatSeverity(severity: string) {
  if (severity === "severe") return "Severe";
  if (severity === "moderate") return "Moderate";
  if (severity === "minor") return "Minor";
  return severity || "—";
}

function formatKetone(level: KetoneLevel | "") {
  if (!level) return "—";
  if (level === "none") return "None";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function segmentClass(active: boolean) {
  return cn(
    "h-9 min-h-0 flex-1 rounded-lg px-1.5 text-xs font-medium shadow-none transition-colors sm:text-sm",
    active
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60 dark:bg-background/90"
      : "text-muted-foreground hover:text-foreground",
  );
}

export type SickDayCgmBgFieldProps = {
  prefill: BgPrefillResult | null;
  loading: boolean;
  onRefresh: () => void;
  emptyHint?: string;
};

export type SickDayReadingsFieldsProps = {
  severity: string;
  onSeverityChange: (v: string) => void;
  bgLevel: string;
  onBgLevelChange: (v: string) => void;
  ketoneLevel: KetoneLevel | "";
  onKetoneLevelChange: (v: KetoneLevel) => void;
  bgUnits: string;
  idPrefix?: string;
  cgm?: SickDayCgmBgFieldProps;
};

export function SickDayReadingsFields({
  severity,
  onSeverityChange,
  bgLevel,
  onBgLevelChange,
  ketoneLevel,
  onKetoneLevelChange,
  bgUnits,
  idPrefix = "sickday",
  cgm,
}: SickDayReadingsFieldsProps) {
  const severityId = `${idPrefix}-severity`;
  const bgId = `${idPrefix}-bg`;
  const ketoneId = `${idPrefix}-ketones`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label id={severityId} className="text-xs font-medium text-muted-foreground">
          How unwell
        </Label>
        <div
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted/45 p-1 dark:bg-muted/30"
          role="group"
          aria-labelledby={severityId}
          data-testid="select-severity"
        >
          {(
            [
              { value: "minor", label: "Minor" },
              { value: "moderate", label: "Moderate" },
              { value: "severe", label: "Severe" },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(segmentClass(severity === opt.value), "w-full")}
              onClick={() => onSeverityChange(opt.value)}
              data-testid={`button-severity-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={bgId} className="text-xs font-medium text-muted-foreground">
          Blood glucose
        </Label>
        <div className="flex items-stretch gap-2">
          <Input
            id={bgId}
            type="number"
            placeholder={bgUnits === "mmol/L" ? "10.0" : "180"}
            value={bgLevel}
            onChange={(e) => onBgLevelChange(e.target.value)}
            className="h-12 flex-1 rounded-xl border-border/60 bg-background text-xl font-semibold tabular-nums tracking-tight shadow-none"
            data-testid="input-bg-level"
          />
          <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
            {bgUnits}
          </span>
        </div>
        {cgm ? (
          <CgmPrefillButton
            prefill={cgm.prefill}
            loading={cgm.loading}
            bgUnits={bgUnits}
            currentValue={bgLevel}
            onApply={onBgLevelChange}
            onRefresh={cgm.onRefresh}
            emptyHint={cgm.emptyHint}
            allowSync
            testId={`${idPrefix}-cgm-prefill`}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label id={ketoneId} className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          Ketones
          <InfoTooltip {...DIABETES_TERMS.ketones} />
        </Label>
        <div
          className="grid grid-cols-5 gap-1 rounded-xl bg-muted/45 p-1 dark:bg-muted/30"
          role="group"
          aria-labelledby={ketoneId}
          data-testid="select-ketone-level"
        >
          {(
            [
              { value: "none", label: "None" },
              { value: "trace", label: "Trace" },
              { value: "small", label: "Small" },
              { value: "moderate", label: "Mod" },
              { value: "large", label: "Large" },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(segmentClass(ketoneLevel === opt.value), "w-full px-0.5")}
              onClick={() => onKetoneLevelChange(opt.value)}
              data-testid={`button-ketone-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export type SickDayTddFieldProps = {
  tdd: string;
  hasTdd: boolean;
};

export function SickDayTddField({ tdd, hasTdd }: SickDayTddFieldProps) {
  if (!hasTdd) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          Set TDD in{" "}
          <Link href="/settings/ratios" className="font-medium text-primary hover:underline" data-testid="link-settings-insulin">
            Insulin & Ratios
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/70 px-3 py-2.5">
      <Label htmlFor="tdd" className="flex items-center gap-1 text-sm font-medium">
        TDD
        <InfoTooltip {...DIABETES_TERMS.tdd} />
      </Label>
      <div className="flex items-baseline gap-1.5">
        <Input
          id="tdd"
          type="number"
          value={tdd}
          readOnly
          className="h-9 w-20 cursor-default bg-muted/50 text-right font-semibold tabular-nums"
          data-testid="input-tdd"
        />
        <span className="text-sm text-muted-foreground">u/day</span>
      </div>
    </div>
  );
}

type SickDayUpdateReadingsCollapsibleProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  severity: string;
  onSeverityChange: (v: string) => void;
  bgLevel: string;
  onBgLevelChange: (v: string) => void;
  ketoneLevel: KetoneLevel | "";
  onKetoneLevelChange: (v: KetoneLevel) => void;
  bgUnits: string;
  onCalculate: () => void;
  idPrefix?: "standalone" | "active";
  cgm?: SickDayCgmBgFieldProps;
};

export function SickDayUpdateReadingsCollapsible({
  open,
  onOpenChange,
  severity,
  onSeverityChange,
  bgLevel,
  onBgLevelChange,
  ketoneLevel,
  onKetoneLevelChange,
  bgUnits,
  onCalculate,
  idPrefix = "standalone",
  cgm,
}: SickDayUpdateReadingsCollapsibleProps) {
  const summary =
    bgLevel && ketoneLevel && severity
      ? `${formatSeverity(severity)} · ${bgLevel} ${bgUnits} · ${formatKetone(ketoneLevel)}`
      : "Glucose, ketones, severity";

  return (
    <Card
      className="overflow-hidden rounded-[1.35rem] border-amber-500/20 bg-gradient-to-b from-amber-500/[0.07] via-card to-card shadow-none dark:border-amber-400/15 dark:from-amber-950/40"
      data-testid="card-sickday-update-readings"
    >
      <Collapsible open={open} onOpenChange={onOpenChange} className="group">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-amber-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            data-testid="sickday-update-readings-trigger"
            aria-expanded={open}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-200"
              aria-hidden
            >
              <Thermometer className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold tracking-tight text-foreground">Update readings</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{summary}</p>
            </div>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t border-amber-500/10 px-4 pb-4 pt-4">
            <SickDayReadingsFields
              severity={severity}
              onSeverityChange={onSeverityChange}
              bgLevel={bgLevel}
              onBgLevelChange={onBgLevelChange}
              ketoneLevel={ketoneLevel}
              onKetoneLevelChange={onKetoneLevelChange}
              bgUnits={bgUnits}
              idPrefix={idPrefix === "active" ? "update-active" : "update"}
              cgm={cgm}
            />
            <Button
              type="button"
              onClick={onCalculate}
              className="h-12 w-full rounded-xl font-semibold"
              data-testid={idPrefix === "active" ? "button-update-readings-active" : "button-update-readings"}
            >
              <Activity className="mr-2 h-4 w-4" aria-hidden />
              Update plan
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

type SickDayResultsPanelProps = {
  results: SickDayResultsViewModel;
  verdict: SickDayVerdictViewModel | null;
  bgLevel: string;
  bgUnits: string;
  severity: string;
  ketoneLevel: KetoneLevel | "";
  isPumpUser: boolean;
  lastUpdatedLabel?: string | null;
  title?: string;
};

function ketoneAccent(action: SickDayResultsViewModel["ketoneActionRequired"]) {
  if (action === "emergency") return "border-red-500/40 bg-red-500/10";
  if (action === "urgent") return "border-red-500/30 bg-red-500/8";
  if (action === "monitor") return "border-amber-500/30 bg-amber-500/8";
  return "border-emerald-500/25 bg-emerald-500/6";
}

export function SickDayResultsPanel({
  results,
  verdict,
  bgLevel,
  bgUnits,
  severity,
  ketoneLevel,
  isPumpUser,
  lastUpdatedLabel,
}: SickDayResultsPanelProps) {
  const verdictBadgeClass =
    verdict?.tone === "critical"
      ? "bg-red-500/15 text-red-800 dark:text-red-100"
      : verdict?.tone === "caution"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
        : "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";

  const heroSurface =
    verdict?.tone === "critical"
      ? "border-red-500/30 bg-gradient-to-br from-red-500/[0.12] via-card to-card shadow-[0_12px_40px_-24px_rgba(239,68,68,0.45)]"
      : verdict?.tone === "caution"
        ? "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.10] via-card to-card shadow-[0_12px_40px_-24px_rgba(245,158,11,0.45)]"
        : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.10] via-card to-card shadow-[0_12px_40px_-24px_rgba(16,185,129,0.45)]";

  const ketoneLine =
    results.ketoneActionRequired === "emergency" || results.ketoneActionRequired === "urgent"
      ? results.ketoneWarningBrief || results.ketoneWarning
      : results.ketoneGuidanceBrief || results.ketoneGuidance;

  const careRows = [
    {
      icon: Syringe,
      label: isPumpUser ? "Basal" : "Long-acting",
      value: results.basalAdjustmentBrief || results.basalAdjustment,
      tone: "text-primary",
    },
    {
      icon: Droplets,
      label: "Fluids",
      value: results.hydrationBrief || results.hydrationNote,
      tone: "text-sky-600 dark:text-sky-400",
    },
    {
      icon: Clock,
      label: "Checks",
      value: results.monitoringBrief || results.monitoringFrequency,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-3" data-testid="card-sickday-recommendations">
      {(results.ketoneActionRequired === "emergency" || results.ketoneActionRequired === "urgent") && (
        <div
          className={cn(
            "rounded-[1.35rem] border px-4 py-3.5",
            results.ketoneActionRequired === "emergency" ? "border-red-600 bg-red-600 text-white" : ketoneAccent("urgent"),
          )}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">
                {results.ketoneActionRequired === "emergency" ? "Get help now" : "Contact your team"}
              </p>
              <p className={cn("mt-1 text-sm leading-relaxed", results.ketoneActionRequired === "emergency" ? "text-red-50" : "text-foreground/85")}>
                {ketoneLine}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={cn("overflow-hidden rounded-[1.35rem] border", heroSurface)}>
        <div className="px-4 pb-4 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {results.correctionDose > 0 ? "Suggested correction" : "Your plan"}
              </p>
              {results.correctionDose > 0 ? (
                <p
                  className="mt-1 font-display text-[2.5rem] font-bold leading-none tabular-nums tracking-tight text-foreground"
                  data-testid="text-correction-dose"
                >
                  {results.correctionDose}
                  <span className="ml-0.5 text-xl font-semibold text-muted-foreground">u</span>
                </p>
              ) : (
                <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
                  {verdict?.title ?? "Review below"}
                </p>
              )}
            </div>
            {verdict ? (
              <Badge variant="secondary" className={cn("shrink-0 rounded-full px-2.5 py-1 font-medium", verdictBadgeClass)}>
                {verdict.label}
              </Badge>
            ) : null}
          </div>
          {verdict?.message ? (
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{verdict.message}</p>
          ) : null}
          <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border/40 pt-3.5">
            <span className="inline-flex items-center rounded-xl bg-background/80 px-3 py-1.5 text-sm font-semibold tabular-nums ring-1 ring-border/50">
              {bgLevel || "—"} {bgUnits}
            </span>
            <span className="inline-flex items-center rounded-xl bg-background/50 px-3 py-1.5 text-sm font-medium ring-1 ring-border/40">
              {formatSeverity(severity)}
            </span>
            <span className="inline-flex items-center rounded-xl bg-background/50 px-3 py-1.5 text-sm font-medium ring-1 ring-border/40">
              Ketones {formatKetone(ketoneLevel)}
            </span>
          </div>
          {lastUpdatedLabel ? (
            <p className="mt-2 text-sm text-muted-foreground">{lastUpdatedLabel}</p>
          ) : null}
        </div>
      </div>

      {results.ketoneActionRequired === "monitor" && ketoneLine ? (
        <div className={cn("rounded-[1.35rem] border px-4 py-3", ketoneAccent("monitor"))}>
          <p className="text-sm font-semibold text-foreground">Keep checking ketones</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">{ketoneLine}</p>
        </div>
      ) : null}

      {results.stackingWarning ? (
        <div className="rounded-[1.35rem] border border-orange-500/25 bg-orange-500/8 px-4 py-3 dark:bg-orange-950/30">
          <p className="text-sm font-semibold text-foreground">Space corrections</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">{results.stackingWarningBrief || results.stackingWarning}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2">
        {careRows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-start gap-3 rounded-[1.15rem] border border-border/50 bg-card/70 px-3.5 py-3"
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", row.tone)} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <p className="mt-0.5 text-sm leading-snug text-foreground/85">{row.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[1.35rem] border border-border/50 bg-card/70 px-3.5 py-3.5">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Meal ratios</p>
          <p className="text-sm font-semibold tabular-nums text-muted-foreground">×{results.ratioMultiplier}</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { label: "Breakfast", ratio: results.breakfastRatio, original: results.originalBreakfastRatio, testId: "breakfast" },
              { label: "Lunch", ratio: results.lunchRatio, original: results.originalLunchRatio, testId: "lunch" },
              { label: "Dinner", ratio: results.dinnerRatio, original: results.originalDinnerRatio, testId: "dinner" },
              { label: "Snacks", ratio: results.snackRatio, original: results.originalSnackRatio, testId: "snack" },
            ] as const
          ).map((row) => (
            <div
              key={row.label}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">{row.label}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums" data-testid={`text-${row.testId}-ratio`}>
                {row.ratio}
              </span>
            </div>
          ))}
        </div>
      </div>

      {results.correctionDose > 0 ? (
        <Collapsible className="group overflow-hidden rounded-[1.35rem] border border-border/50 bg-card/50">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
            How this was calculated
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2.5 border-t border-border/50 px-4 pb-4 pt-3">
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-xl bg-muted/40 px-2 py-2 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">Base</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{results.baseCorrectionDose}u</p>
              </div>
              <div className="rounded-xl bg-muted/40 px-2 py-2 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">Safety</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">×{results.severityModifier}</p>
              </div>
              <div className="rounded-xl bg-muted/40 px-2 py-2 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">BG zone</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">×{results.bgZoneModifier}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-foreground/85">{results.correctionExplanation}</p>
            <MedicalNumericOutputDisclaimer compact />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {isPumpUser ? (
        <Collapsible className="group overflow-hidden rounded-[1.35rem] border border-border/50 bg-card/50">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
            Pump tips
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 border-t border-border/50 px-4 pb-4 pt-3 text-sm leading-relaxed text-foreground/85">
            <p>Change set/site if glucose stays high after two corrections.</p>
            <p>Use your pump calculator and check IOB.</p>
            {(ketoneLevel === "moderate" || ketoneLevel === "large") && (
              <p className="font-medium">Moderate/large ketones: pens may be safer — ask your team.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
