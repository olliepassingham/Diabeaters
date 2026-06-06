import { Activity, AlertCircle, ChevronDown, Clock, Thermometer, Wine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { cn } from "@/lib/utils";

export type BedtimeCorrectionData = {
  fullDose: number;
  suggestedDose: number;
  currentBg: number;
  targetBg: number;
  correctionFactor: number;
  bgUnits: string;
  iobWarning: string;
  exerciseWarning: string;
  alcoholWarning: string;
  sickDayWarning: string;
};

type WarningItem = {
  id: string;
  text: string;
  tone: "amber" | "red" | "orange" | "blue";
  icon: typeof AlertCircle;
  testId: string;
};

export function BedtimeCorrectionPanel({
  correction,
  isPumpUser,
  hoursUntilSleep,
}: {
  correction: BedtimeCorrectionData;
  isPumpUser: boolean;
  hoursUntilSleep: string;
}) {
  const pct =
    correction.fullDose > 0 ? Math.round((correction.suggestedDose / correction.fullDose) * 100) : 0;

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

  const iconClasses = {
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    orange: "text-orange-600 dark:text-orange-400",
    blue: "text-sky-600 dark:text-sky-400",
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
      data-testid="card-correction-suggestion"
    >
      <div className="border-b border-border/50 bg-gradient-to-br from-violet-500/[0.07] via-card to-indigo-500/[0.05] px-4 py-5 sm:px-5">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested bedtime dose
        </p>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <span
            className="text-5xl font-semibold tracking-tight tabular-nums text-foreground"
            data-testid="text-correction-suggested-dose"
          >
            {correction.suggestedDose}
          </span>
          <span className="text-lg font-medium text-muted-foreground">units</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="rounded-full px-2.5 text-xs font-medium">
            ~{pct}% of full dose
          </Badge>
          <span className="text-sm tabular-nums text-muted-foreground">
            <span data-testid="text-correction-current-bg">{correction.currentBg}</span>
            {" → "}
            <span data-testid="text-correction-target-bg">{correction.targetBg}</span> {correction.bgUnits}
          </span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="border-b border-border/50 px-4 py-3 sm:px-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Before you decide
          </p>
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
      ) : null}

      <Collapsible className="group">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/20 sm:px-5">
          How we calculated this
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3 sm:px-5">
          <p className="text-sm tabular-nums text-muted-foreground">
            ({correction.currentBg} − {correction.targetBg}) ÷ {correction.correctionFactor} ={" "}
            {correction.fullDose}u full correction
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">
            Reduced for overnight safety — many teams recommend a cautious bedtime approach (~50% of a daytime
            correction).
            {correction.fullDose > correction.suggestedDose ? ` Full dose would be ${correction.fullDose}u.` : ""}
          </p>
          {isPumpUser ? (
            <p className="text-sm text-indigo-700 dark:text-indigo-300" data-testid="text-pump-correction-tip">
              Check your pump&apos;s IOB — active insulin may already be working on this high.
            </p>
          ) : null}
          <MedicalNumericOutputDisclaimer collapsible />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
