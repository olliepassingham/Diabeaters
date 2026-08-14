import { Activity, AlertCircle, AlertTriangle, ChevronDown, Clock, Thermometer, Wine } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { ScenarioResultHero, ScenarioResultHeroSuffix } from "@/components/scenarios/scenario-result-hero";
import { cn } from "@/lib/utils";

export type BedtimeCorrectionData = {
  fullDose: number;
  suggestedDose: number;
  pctOfFullDose: number;
  bedtimeReduction: number;
  currentBg: number;
  targetBg: number;
  correctionFactor: number;
  bgUnits: string;
  trendNote: string;
  overnightTrendNote: string;
  extraCautionNote: string;
  iobWarning: string;
  exerciseWarning: string;
  alcoholWarning: string;
  hypoWarning: string;
  sickDayWarning: string;
};

type WarningItem = {
  id: string;
  text: string;
  tone: "amber" | "red" | "orange" | "blue";
  icon: typeof AlertCircle;
  testId: string;
};

function buildWarnings(
  correction: BedtimeCorrectionData,
  hoursUntilSleep: string,
): WarningItem[] {
  const warnings: WarningItem[] = [];
  if (correction.iobWarning) {
    warnings.push({
      id: "iob",
      text: correction.iobWarning,
      tone: "amber",
      icon: AlertCircle,
      testId: "text-correction-iob-warning",
    });
  }
  if (correction.exerciseWarning) {
    warnings.push({
      id: "exercise",
      text: correction.exerciseWarning,
      tone: "amber",
      icon: Activity,
      testId: "text-correction-exercise-warning",
    });
  }
  if (correction.alcoholWarning) {
    warnings.push({
      id: "alcohol",
      text: correction.alcoholWarning,
      tone: "red",
      icon: Wine,
      testId: "text-correction-alcohol-warning",
    });
  }
  if (correction.hypoWarning) {
    warnings.push({
      id: "hypo",
      text: correction.hypoWarning,
      tone: "orange",
      icon: AlertTriangle,
      testId: "text-correction-hypo-warning",
    });
  }
  if (correction.sickDayWarning) {
    warnings.push({
      id: "sick",
      text: correction.sickDayWarning,
      tone: "orange",
      icon: Thermometer,
      testId: "text-correction-sick-warning",
    });
  }
  const sleepHours = hoursUntilSleep ? parseFloat(hoursUntilSleep) : NaN;
  if (Number.isFinite(sleepHours) && sleepHours > 1.5) {
    warnings.push({
      id: "timing",
      text: "You're not sleeping just yet — recheck before bed if you correct now.",
      tone: "blue",
      icon: Clock,
      testId: "text-correction-timing-note",
    });
  }
  return warnings;
}

function compactWhyLine(correction: BedtimeCorrectionData): string {
  const iob = Boolean(correction.iobWarning);
  const alcohol = Boolean(correction.alcoholWarning);
  const exercise = Boolean(correction.exerciseWarning);
  if (iob && alcohol) return "Held back mainly for recent insulin, with extra caution for alcohol.";
  if (iob && exercise) return "Held back mainly for recent insulin, with extra caution after exercise.";
  if (iob) return "Held back for insulin still on board.";
  if (alcohol && exercise) return "Held back for exercise and delayed lows after alcohol.";
  if (alcohol) return "Held back for delayed lows after alcohol.";
  if (exercise) return "Held back because exercise can raise overnight sensitivity.";
  if (correction.overnightTrendNote) return correction.overnightTrendNote;
  return "";
}

function reasonChips(correction: BedtimeCorrectionData): { id: string; label: string }[] {
  const chips: { id: string; label: string }[] = [];
  if (correction.iobWarning) chips.push({ id: "iob", label: "Active insulin" });
  if (correction.alcoholWarning) chips.push({ id: "alcohol", label: "Alcohol" });
  if (correction.exerciseWarning) chips.push({ id: "exercise", label: "Exercise" });
  if (correction.hypoWarning) chips.push({ id: "hypo", label: "Recent hypo" });
  if (/rise overnight/i.test(correction.overnightTrendNote)) chips.push({ id: "rise", label: "Usually rises" });
  else if (/fall overnight/i.test(correction.overnightTrendNote)) chips.push({ id: "fall", label: "Usually falls" });
  return chips;
}

function compactWarningText(warning: WarningItem): string {
  if (warning.id === "iob") return "Recent insulin is still active — that's why this is less than a full correction.";
  if (warning.id === "alcohol") return "Alcohol can cause delayed lows later tonight.";
  if (warning.id === "exercise") return "Exercise can raise insulin sensitivity overnight.";
  return warning.text;
}

const iconClasses = {
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  orange: "text-orange-600 dark:text-orange-400",
  blue: "text-sky-600 dark:text-sky-400",
};

function WarningsList({ warnings }: { warnings: WarningItem[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3 sm:px-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before you decide</p>
      <ul className="space-y-2">
        {warnings.map((w) => {
          const Icon = w.icon;
          return (
            <li key={w.id} className="flex items-start gap-2.5 text-sm leading-snug text-foreground/90">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClasses[w.tone])} aria-hidden />
              <span data-testid={w.testId}>{w.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CalculationDetails({
  correction,
  isPumpUser,
}: {
  correction: BedtimeCorrectionData;
  isPumpUser: boolean;
}) {
  const bedtimePct = Math.round(correction.bedtimeReduction * 100);
  return (
    <Collapsible className="group overflow-hidden rounded-2xl border border-border/60 bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/20 sm:px-5">
        How we calculated this
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3 sm:px-5">
        <p className="text-sm tabular-nums text-muted-foreground">
          ({correction.currentBg} − {correction.targetBg}) ÷ {correction.correctionFactor} = {correction.fullDose}u
          full correction
        </p>
        <p className="text-sm leading-relaxed text-foreground/90">{correction.trendNote}</p>
        {correction.overnightTrendNote ? (
          <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-correction-overnight-note">
            {correction.overnightTrendNote}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-foreground/90">
          Applied ~{bedtimePct}% for bedtime safety
          {correction.fullDose > correction.suggestedDose
            ? ` → ${correction.suggestedDose}u suggested (full would be ${correction.fullDose}u).`
            : "."}
        </p>
        {correction.extraCautionNote ? (
          <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-correction-extra-caution-note">
            {correction.extraCautionNote}
          </p>
        ) : null}
        {isPumpUser ? (
          <p className="text-sm text-muted-foreground" data-testid="text-pump-correction-tip">
            Check your pump&apos;s IOB — active insulin may already be working on this high.
          </p>
        ) : null}
        <MedicalNumericOutputDisclaimer collapsible />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BedtimeCorrectionPanel({
  correction,
  isPumpUser,
  hoursUntilSleep,
  variant = "compact",
}: {
  correction: BedtimeCorrectionData;
  isPumpUser: boolean;
  hoursUntilSleep: string;
  variant?: "compact" | "details";
}) {
  const warnings = buildWarnings(correction, hoursUntilSleep);
  const topWarning = warnings[0];
  const chips = reasonChips(correction);
  const why = compactWhyLine(correction);

  if (variant === "details") {
    return (
      <div className="space-y-3" data-testid="card-correction-suggestion">
        <WarningsList warnings={warnings} />
        <CalculationDetails correction={correction} isPumpUser={isPumpUser} />
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="card-correction-suggestion">
      <ScenarioResultHero
        label="Suggested bedtime dose"
        value={
          <>
            {correction.suggestedDose}
            <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
          </>
        }
        valueTestId="text-correction-suggested-dose"
      >
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="rounded-full px-2.5 text-xs font-medium">
            {correction.suggestedDose}u of {correction.fullDose}u
          </Badge>
          <span className="text-sm tabular-nums text-muted-foreground">
            <span data-testid="text-correction-current-bg">{correction.currentBg}</span>
            {" → "}
            <span data-testid="text-correction-target-bg">{correction.targetBg}</span> {correction.bgUnits}
          </span>
        </div>
        {chips.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.id}
                data-testid={`chip-correction-${chip.id}`}
                className="rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-medium text-foreground ring-1 ring-border/50"
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
        {why ? (
          <p className="mx-auto mt-2.5 max-w-sm text-sm leading-snug text-foreground/85">{why}</p>
        ) : null}
      </ScenarioResultHero>

      {topWarning ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-sm text-foreground/90">
          {(() => {
            const Icon = topWarning.icon;
            return <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClasses[topWarning.tone])} aria-hidden />;
          })()}
          <span data-testid={topWarning.testId}>{compactWarningText(topWarning)}</span>
        </div>
      ) : null}
    </div>
  );
}
