import { AlertCircle, Activity, ChevronDown, Clock, Droplets, Syringe, Thermometer } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="space-y-2">
        <Label htmlFor={severityId} className="text-sm font-medium">
          Illness severity
        </Label>
        <Select value={severity} onValueChange={onSeverityChange}>
          <SelectTrigger id={severityId} data-testid="select-severity">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minor">Minor — cold, feeling off</SelectItem>
            <SelectItem value="moderate">Moderate — fever, flu</SelectItem>
            <SelectItem value="severe">Severe — vomiting, can&apos;t eat</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={bgId} className="text-sm font-medium">
            Blood glucose ({bgUnits})
          </Label>
          <Input
            id={bgId}
            type="number"
            placeholder={bgUnits === "mmol/L" ? "e.g. 10.0" : "e.g. 180"}
            value={bgLevel}
            onChange={(e) => onBgLevelChange(e.target.value)}
            data-testid="input-bg-level"
          />
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
        <div className="space-y-2">
          <Label htmlFor={ketoneId} className="flex items-center gap-1 text-sm font-medium">
            Ketones
            <InfoTooltip {...DIABETES_TERMS.ketones} />
          </Label>
          <Select value={ketoneLevel} onValueChange={(val) => onKetoneLevelChange(val as KetoneLevel)}>
            <SelectTrigger id={ketoneId} data-testid="select-ketone-level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="trace">Trace</SelectItem>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
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
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground">
          Set TDD in{" "}
          <Link href="/settings/ratios" className="font-medium text-primary hover:underline" data-testid="link-settings-insulin">
            Insulin & Ratios
          </Link>{" "}
          to use the adviser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="tdd" className="flex items-center gap-1 text-sm font-medium">
        Total Daily Dose (TDD)
        <InfoTooltip {...DIABETES_TERMS.tdd} />
      </Label>
      <div className="flex items-center gap-2 max-w-xs">
        <Input id="tdd" type="number" value={tdd} readOnly className="cursor-default bg-muted" data-testid="input-tdd" />
        <span className="shrink-0 text-xs text-muted-foreground">u/day</span>
      </div>
      <p className="text-xs text-muted-foreground">
        From{" "}
        <Link href="/settings/ratios" className="text-primary hover:underline" data-testid="link-insulin-settings">
          Insulin & Ratios
        </Link>
      </p>
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
      ? `${formatSeverity(severity)} · ${bgLevel} ${bgUnits} · ketones ${formatKetone(ketoneLevel)}`
      : "Tap to update glucose, ketones, or severity";

  return (
    <Card className="surface-card border-border/60 shadow-none" data-testid="card-sickday-update-readings">
      <Collapsible open={open} onOpenChange={onOpenChange} className="group">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            data-testid="sickday-update-readings-trigger"
            aria-expanded={open}
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">Update readings</p>
              <p className="text-xs text-muted-foreground">{summary}</p>
            </div>
            <ChevronDown
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t border-border/50 pt-4">
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
      ? "border-red-500/35 bg-gradient-to-b from-red-500/12 via-card to-card"
      : verdict?.tone === "caution"
        ? "border-amber-500/35 bg-gradient-to-b from-amber-500/10 via-card to-card"
        : "border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card";

  const contextLine = `${formatSeverity(severity)} · BG ${bgLevel || "—"} ${bgUnits} · ketones ${formatKetone(ketoneLevel)}`;
  const ketoneLine =
    results.ketoneActionRequired === "emergency" || results.ketoneActionRequired === "urgent"
      ? results.ketoneWarningBrief || results.ketoneWarning
      : results.ketoneGuidanceBrief || results.ketoneGuidance;

  return (
    <div className="space-y-3" data-testid="card-sickday-recommendations">
      {(results.ketoneActionRequired === "emergency" || results.ketoneActionRequired === "urgent") && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3",
            results.ketoneActionRequired === "emergency" ? "border-red-600 bg-red-600 text-white" : ketoneAccent("urgent"),
          )}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {results.ketoneActionRequired === "emergency" ? "Emergency — get help now" : "Urgent — contact your team"}
              </p>
              <p className={cn("mt-1 text-xs leading-relaxed", results.ketoneActionRequired === "emergency" ? "text-red-100" : "text-foreground/85")}>
                {ketoneLine}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={cn("overflow-hidden rounded-2xl border shadow-sm ring-1 ring-border/20", heroSurface)}>
        <div className="relative px-5 pb-4 pt-5 text-center">
          {verdict ? (
            <Badge
              variant="secondary"
              className={cn("absolute right-3 top-3 rounded-full font-medium", verdictBadgeClass)}
            >
              {verdict.label}
            </Badge>
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">
            {results.correctionDose > 0 ? "Suggested correction" : "Your plan"}
          </p>
          {results.correctionDose > 0 ? (
            <p className="mt-1 font-display text-5xl font-bold tabular-nums tracking-tight text-foreground" data-testid="text-correction-dose">
              {results.correctionDose}
              <span className="text-2xl font-semibold text-muted-foreground">u</span>
            </p>
          ) : (
            <p className="mt-1 text-xl font-semibold text-foreground">{verdict?.title ?? "Review below"}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{contextLine}</p>
          {verdict ? <p className="mt-2 text-xs text-foreground/85">{verdict.message}</p> : null}
          {lastUpdatedLabel ? <p className="mt-1 text-[11px] text-muted-foreground">{lastUpdatedLabel}</p> : null}
        </div>
      </div>

      {results.ketoneActionRequired === "monitor" && ketoneLine ? (
        <div className={cn("rounded-2xl border px-4 py-3", ketoneAccent("monitor"))}>
          <p className="text-sm font-semibold text-foreground">Ketones — keep monitoring</p>
          <p className="mt-1 text-xs text-foreground/80">{ketoneLine}</p>
        </div>
      ) : null}

      {results.stackingWarning ? (
        <div className="rounded-2xl border border-orange-500/25 bg-orange-500/8 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Space corrections</p>
          <p className="mt-1 text-xs text-foreground/80">{results.stackingWarningBrief || results.stackingWarning}</p>
        </div>
      ) : null}

      {results.correctionDose > 0 ? (
        <Collapsible className="group rounded-2xl border border-border/60 bg-card/40">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
            How this was calculated
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 border-t border-border/50 px-4 pb-4 pt-2 text-xs text-muted-foreground">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-[10px] uppercase tracking-wide opacity-70">Base</p>
                <p className="text-sm font-semibold tabular-nums">{results.baseCorrectionDose}u</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-[10px] uppercase tracking-wide opacity-70">Safety</p>
                <p className="text-sm font-semibold tabular-nums">×{results.severityModifier}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-[10px] uppercase tracking-wide opacity-70">BG zone</p>
                <p className="text-sm font-semibold tabular-nums">×{results.bgZoneModifier}</p>
              </div>
            </div>
            <p className="italic leading-relaxed">{results.correctionExplanation}</p>
            <MedicalNumericOutputDisclaimer compact />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Collapsible className="group rounded-2xl border border-border/60 bg-card/40">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
          <span>
            Meal ratios <span className="text-muted-foreground font-normal">· ×{results.ratioMultiplier}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { label: "Breakfast", ratio: results.breakfastRatio, original: results.originalBreakfastRatio, testId: "breakfast" },
                { label: "Lunch", ratio: results.lunchRatio, original: results.originalLunchRatio, testId: "lunch" },
                { label: "Dinner", ratio: results.dinnerRatio, original: results.originalDinnerRatio, testId: "dinner" },
                { label: "Snacks", ratio: results.snackRatio, original: results.originalSnackRatio, testId: "snack" },
              ] as const
            ).map((row) => (
              <div key={row.label} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="font-semibold tabular-nums" data-testid={`text-${row.testId}-ratio`}>
                    {row.ratio}
                  </p>
                  <span className="text-xs text-muted-foreground line-through tabular-nums">{row.original}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="rounded-2xl border border-border/60 bg-card/40 px-4 py-3 space-y-2.5">
        <p className="text-sm font-semibold text-foreground">Basal, fluids & checks</p>
        <div className="flex gap-2.5 text-xs">
          <Syringe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <p className="text-foreground/85">
            <span className="font-medium text-muted-foreground">{isPumpUser ? "Basal" : "Long-acting"}: </span>
            {results.basalAdjustmentBrief || results.basalAdjustment}
          </p>
        </div>
        <div className="flex gap-2.5 text-xs">
          <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
          <p className="text-foreground/85">
            <span className="font-medium text-muted-foreground">Fluids: </span>
            {results.hydrationBrief || results.hydrationNote}
          </p>
        </div>
        <div className="flex gap-2.5 text-xs">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-foreground/85">
            <span className="font-medium text-muted-foreground">Checks: </span>
            {results.monitoringBrief || results.monitoringFrequency}
          </p>
        </div>
      </div>

      {isPumpUser ? (
        <Collapsible className="group rounded-2xl border border-border/60 bg-card/40">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
            Pump tips
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 border-t border-border/50 px-4 pb-4 pt-2 text-xs text-foreground/85">
            <p>Change set/site if glucose stays high after two corrections.</p>
            <p>Use your pump calculator; mind IOB.</p>
            {(ketoneLevel === "moderate" || ketoneLevel === "large") && (
              <p className="font-medium">Moderate/large ketones: pens may be safer — ask your team.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Collapsible className="group rounded-2xl border border-dashed border-border/60 bg-muted/10">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
          Quick reminders
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 px-4 pb-4 pt-2">
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Do not skip basal insulin</li>
            <li>Recheck ketones if BG stays above {bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL"}</li>
            <li>Moderate/large ketones or worsening symptoms: get medical help</li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
