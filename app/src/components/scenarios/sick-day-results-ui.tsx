import { AlertCircle, Activity, ChevronDown, Clock, Droplets, Info, Syringe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Disclaimer } from "@/components/disclaimer";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
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
      <p className="text-center text-[11px] text-muted-foreground">
        Contact your team when unwell — especially with high glucose or ketones.
      </p>
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
}: SickDayUpdateReadingsCollapsibleProps) {
  const severityId = idPrefix === "active" ? "update-severity-active" : "update-severity";
  const bgId = idPrefix === "active" ? "update-bg-active" : "update-bg";
  const ketoneId = idPrefix === "active" ? "update-ketones-active" : "update-ketones";
  const summary =
    bgLevel && ketoneLevel && severity
      ? `${formatSeverity(severity)} · ${bgLevel} ${bgUnits} · ketones ${formatKetone(ketoneLevel)}`
      : "Tap to change glucose, ketones, or severity";

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 shadow-sm ring-1 ring-border/40",
        "bg-card/95",
      )}
      data-testid="card-sickday-update-readings"
    >
      <Collapsible open={open} onOpenChange={onOpenChange} className="group">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5 sm:py-5"
            data-testid="sickday-update-readings-trigger"
            aria-expanded={open}
          >
            <div className="min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recalculate
              </span>
              <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Update your readings</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
            </div>
            <ChevronDown
              className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t border-border/50 px-4 pb-5 pt-2 sm:px-5">
            <div className="space-y-2">
              <Label htmlFor={severityId} className="text-sm font-medium">
                Illness severity
              </Label>
              <Select value={severity} onValueChange={onSeverityChange}>
                <SelectTrigger id={severityId} className="h-11" data-testid={`select-${severityId}`}>
                  <SelectValue placeholder="Select severity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor (slight cold, feeling off)</SelectItem>
                  <SelectItem value="moderate">Moderate (fever, flu symptoms)</SelectItem>
                  <SelectItem value="severe">Severe (high fever, vomiting, unable to eat)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={bgId} className="text-sm font-medium">
                  Blood glucose ({bgUnits})
                </Label>
                <Input
                  id={bgId}
                  type="number"
                  placeholder={bgUnits === "mmol/L" ? "e.g., 10.0" : "e.g., 180"}
                  value={bgLevel}
                  onChange={(e) => onBgLevelChange(e.target.value)}
                  className="h-11"
                  data-testid={idPrefix === "active" ? "input-update-bg-active" : "input-update-bg-level"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={ketoneId} className="flex items-center gap-1 text-sm font-medium">
                  Ketone level
                  <InfoTooltip {...DIABETES_TERMS.ketones} />
                </Label>
                <Select value={ketoneLevel} onValueChange={(val) => onKetoneLevelChange(val as KetoneLevel)}>
                  <SelectTrigger id={ketoneId} className="h-11" data-testid={`select-${ketoneId}`}>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (negative)</SelectItem>
                    <SelectItem value="trace">Trace (0.1-0.5)</SelectItem>
                    <SelectItem value="small">Small (0.6-1.5)</SelectItem>
                    <SelectItem value="moderate">Moderate (1.6-3.0)</SelectItem>
                    <SelectItem value="large">Large (3.0+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              onClick={onCalculate}
              className="h-11 w-full rounded-xl font-semibold"
              data-testid={idPrefix === "active" ? "button-update-readings-active" : "button-update-readings"}
            >
              <Activity className="mr-2 h-4 w-4" aria-hidden />
              Update recommendations
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
  /** e.g. latest journal check timestamp (sick day mode). */
  lastUpdatedLabel?: string | null;
  title?: string;
};

export function SickDayResultsPanel({
  results,
  verdict,
  bgLevel,
  bgUnits,
  severity,
  ketoneLevel,
  isPumpUser,
  lastUpdatedLabel,
  title = "Sick day recommendations",
}: SickDayResultsPanelProps) {
  const verdictBadgeClass =
    verdict?.tone === "critical"
      ? "bg-red-500/15 text-red-800 dark:text-red-100"
      : verdict?.tone === "caution"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
        : "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";

  const heroSurface =
    verdict?.tone === "critical"
      ? "border-red-500/35 bg-gradient-to-b from-red-500/15 via-card to-card"
      : verdict?.tone === "caution"
        ? "border-amber-500/35 bg-gradient-to-b from-amber-500/12 via-card to-card"
        : "border-emerald-600/30 bg-gradient-to-b from-emerald-500/12 via-card to-card";

  return (
    <Card
      className={cn("overflow-hidden rounded-2xl border shadow-sm", heroSurface)}
      data-testid="card-sickday-recommendations"
    >
      <div className="space-y-3 border-b border-border/40 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your plan</p>
            <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
              {verdict?.title ?? title}
            </h2>
            {lastUpdatedLabel ? (
              <p className="text-xs text-muted-foreground">{lastUpdatedLabel}</p>
            ) : verdict ? (
              <p className="text-sm leading-relaxed text-foreground/85">{verdict.message}</p>
            ) : null}
          </div>
          {verdict ? (
            <Badge variant="secondary" className={cn("shrink-0 rounded-full font-medium", verdictBadgeClass)}>
              {verdict.label}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2" data-testid="sickday-results-snapshot">
          <Badge variant="outline" className="rounded-full bg-background/70 font-normal tabular-nums">
            BG {bgLevel || "—"} {bgUnits}
          </Badge>
          <Badge variant="outline" className="rounded-full bg-background/70 font-normal capitalize">
            {formatSeverity(severity)}
          </Badge>
          <Badge variant="outline" className="rounded-full bg-background/70 font-normal">
            Ketones {formatKetone(ketoneLevel)}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
        {results.ketoneActionRequired === "emergency" && (
          <div className="rounded-xl border-2 border-red-600 bg-red-600 p-4 dark:border-red-500 dark:bg-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-white" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-white">Emergency — get medical help now</p>
                <p className="mt-1 text-sm text-red-100">{results.ketoneWarningBrief || results.ketoneWarning}</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {results.ketoneGuidanceBrief || results.ketoneGuidance}
                </p>
              </div>
            </div>
          </div>
        )}

        {results.ketoneActionRequired === "urgent" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">Urgent — contact your diabetes team</p>
                <p className="mt-1 text-sm text-red-800 dark:text-red-200">
                  {results.ketoneWarningBrief || results.ketoneWarning}
                </p>
              </div>
            </div>
          </div>
        )}

        {results.ketoneActionRequired === "monitor" && results.ketoneGuidance ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Ketones — keep monitoring</p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  {results.ketoneGuidanceBrief || results.ketoneGuidance}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {results.ketoneActionRequired === "none" && results.ketoneGuidance ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                {results.ketoneGuidanceBrief || results.ketoneGuidance}
              </p>
            </div>
          </div>
        ) : null}

        {results.correctionDose > 0 ? (
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.1] via-card to-card p-4 text-center shadow-sm sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">Suggested correction</p>
            <p className="mt-1 flex items-baseline justify-center gap-1.5" data-testid="text-correction-dose">
              <span className="font-display text-5xl font-bold tabular-nums tracking-tight text-foreground">
                {results.correctionDose}
              </span>
              <span className="text-lg font-medium text-muted-foreground">u</span>
            </p>
            <Collapsible className="group mt-3 border-t border-primary/15 pt-3">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm font-medium text-foreground">
                How we calculated this
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 text-xs text-muted-foreground">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-background/80 p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide opacity-70">Base</p>
                    <p className="text-sm font-semibold tabular-nums">{results.baseCorrectionDose}u</p>
                  </div>
                  <div className="rounded-lg bg-background/80 p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide opacity-70">Safety</p>
                    <p className="text-sm font-semibold tabular-nums">×{results.severityModifier}</p>
                  </div>
                  <div className="rounded-lg bg-background/80 p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide opacity-70">BG zone</p>
                    <p className="text-sm font-semibold tabular-nums">×{results.bgZoneModifier}</p>
                  </div>
                </div>
                <p className="italic leading-relaxed">{results.correctionExplanation}</p>
                <MedicalNumericOutputDisclaimer compact />
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : null}

        {results.stackingWarning ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50/90 p-3 dark:border-orange-800 dark:bg-orange-950/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">Spacing corrections</p>
                <p className="mt-0.5 text-sm text-orange-800 dark:text-orange-200">
                  {results.stackingWarningBrief || results.stackingWarning}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Mealtime ratios</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                ×{results.ratioMultiplier}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { label: "Breakfast", ratio: results.breakfastRatio, original: results.originalBreakfastRatio, testId: "breakfast" },
                  { label: "Lunch", ratio: results.lunchRatio, original: results.originalLunchRatio, testId: "lunch" },
                  { label: "Dinner", ratio: results.dinnerRatio, original: results.originalDinnerRatio, testId: "dinner" },
                  { label: "Snacks", ratio: results.snackRatio, original: results.originalSnackRatio, testId: "snack" },
                ] as const
              ).map((row) => (
                <div key={row.label} className="rounded-lg border border-border/50 bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="font-semibold tabular-nums" data-testid={`text-${row.testId}-ratio`}>
                      {row.ratio}
                    </p>
                    <span className="text-xs text-muted-foreground line-through tabular-nums">{row.original}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Basal, fluids & checks</h3>
            <div className="flex gap-3 text-sm">
              <Syringe className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-xs font-medium text-muted-foreground">{isPumpUser ? "Basal / pump" : "Long-acting"}</p>
                <p className="text-foreground leading-snug">{results.basalAdjustmentBrief || results.basalAdjustment}</p>
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Fluids</p>
                <p className="text-foreground leading-snug">{results.hydrationBrief || results.hydrationNote}</p>
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Checks</p>
                <p className="text-foreground leading-snug">{results.monitoringBrief || results.monitoringFrequency}</p>
              </div>
            </div>
          </div>
        </div>

        {isPumpUser ? (
          <Collapsible className="group rounded-xl border border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-indigo-900 dark:text-indigo-100">
              Pump tips
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-4 pb-4 text-sm text-indigo-900/90 dark:text-indigo-100/90">
              <p>Change infusion set and site if glucose stays high after two corrections.</p>
              <p>Use your pump calculator; mind IOB.</p>
              {(ketoneLevel === "moderate" || ketoneLevel === "large") && (
                <p className="font-medium">Moderate/large ketones: pens may be safer than pump — ask your team.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-3">
          <p className="text-sm font-medium">Quick reminders</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Do not skip basal insulin</li>
            <li>Recheck ketones if BG stays above {bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL"}</li>
            <li>Moderate/large ketones or worsening symptoms: get medical help</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
