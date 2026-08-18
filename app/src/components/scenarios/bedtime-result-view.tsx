import { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Syringe,
  Wine,
  Thermometer,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BedtimeCorrectionPanel, type BedtimeCorrectionData } from "@/components/scenarios/bedtime-correction-panel";
import { closedLoopSafetyNote } from "@/lib/closed-loop";
import { storage } from "@/lib/storage";
import {
  getMdiBedtimePostExerciseLine,
  getPumpBedtimePostExerciseLine,
  inferPostExerciseLoadTier,
} from "@/lib/post-exercise-nudge";
import { cn } from "@/lib/utils";

type ReadinessLevel = "steady" | "monitor" | "alert";

type Factor = {
  label: string;
  status: "good" | "caution" | "concern";
  note: string;
  detail?: string;
};

/**
 * The single, coherent recommendation for tonight. Exactly one of these is ever shown — a
 * correction and a snack (or a "missing ISF" prompt) can never appear together, since they are
 * derived from one branch of the same decision tree (see resolveBedtimeAction in bedtime.tsx).
 */
export type BedtimeAction =
  | { kind: "correction"; data: BedtimeCorrectionData }
  | { kind: "dose_too_small"; currentBg: number; aimBg: number; bgUnits: string; rawDose: number; note: string }
  | { kind: "missing_isf" }
  | { kind: "snack"; grams: number; reason: string }
  | { kind: "none" };

export type BedtimeResultViewData = {
  level: ReadinessLevel;
  headline: string;
  bgGlance: { display: string; trendLabel: string; rangeLabel: string };
  guidance: string[];
  tips: string[];
  factors: Factor[];
  action: BedtimeAction;
  bgAboveTarget: boolean;
};

type Props = {
  result: BedtimeResultViewData;
  isPumpUser: boolean;
  usesClosedLoop?: boolean;
  hoursUntilSleep: string;
  exercisedToday: boolean;
  hadAlcohol: boolean;
  lastExerciseLabel: string | null;
};

function verdictLabel(level: ReadinessLevel, aboveTarget?: boolean) {
  if (level === "steady") return "Ready for sleep";
  if (level === "monitor") return aboveTarget ? "Plan before bed" : "Keep an eye on it";
  return "Needs attention";
}

function levelTone(level: ReadinessLevel) {
  switch (level) {
    case "steady":
      return {
        border: "border-emerald-500/25",
        bg: "bg-gradient-to-br from-emerald-500/[0.10] via-card to-card dark:from-emerald-950/40",
        badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
        glow: "shadow-[0_12px_40px_-24px_rgba(16,185,129,0.55)]",
      };
    case "monitor":
      return {
        border: "border-amber-500/30",
        bg: "bg-gradient-to-br from-amber-500/[0.10] via-card to-card dark:from-amber-950/40",
        badge: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
        glow: "shadow-[0_12px_40px_-24px_rgba(245,158,11,0.45)]",
      };
    case "alert":
      return {
        border: "border-red-500/30",
        bg: "bg-gradient-to-br from-red-500/[0.12] via-card to-card dark:from-red-950/45",
        badge: "bg-red-500/15 text-red-800 dark:text-red-100",
        glow: "shadow-[0_12px_40px_-24px_rgba(239,68,68,0.45)]",
      };
  }
}

function StatusIcon({ status }: { status: Factor["status"] }) {
  switch (status) {
    case "good":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />;
    case "caution":
      return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />;
    case "concern":
      return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />;
  }
}

export function BedtimeResultView({
  result,
  isPumpUser,
  usesClosedLoop: loopOn,
  hoursUntilSleep,
  exercisedToday,
  hadAlcohol,
  lastExerciseLabel,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tone = levelTone(result.level);
  const topGuidance = result.guidance.slice(0, 2);
  const extraGuidanceCount = Math.max(0, result.guidance.length - topGuidance.length);

  return (
    <div className="space-y-3" data-testid="card-bedtime-result">
      <div
        className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/25 px-3 py-2"
        data-testid="card-bedtime-save-prompt"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/90">Logged</span>
          {" · "}streak & history updated
        </p>
        <Link href="/tools/hypo-help" className="shrink-0 text-xs font-medium text-primary">
          Hypo help
        </Link>
      </div>

      <div
        className={cn("overflow-hidden rounded-[1.35rem] border", tone.border, tone.bg, tone.glow)}
        data-testid="card-bedtime-result-hero"
      >
        <div className="px-4 pb-4 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tonight</p>
              <h2
                className="mt-1 font-display text-[1.65rem] font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
                data-testid="text-bedtime-verdict"
              >
                {verdictLabel(result.level, result.bgAboveTarget)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.headline}</p>
            </div>
            <Badge variant="secondary" className={cn("shrink-0 rounded-full px-2.5 py-1 font-medium", tone.badge)}>
              {result.bgGlance.rangeLabel}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-3.5">
            <span className="inline-flex items-center rounded-xl bg-background/80 px-3 py-1.5 text-sm font-semibold tabular-nums text-foreground ring-1 ring-border/50">
              {result.bgGlance.display}
            </span>
            <span className="inline-flex items-center rounded-xl bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/40">
              {result.bgGlance.trendLabel}
            </span>
          </div>
        </div>
      </div>

      {result.action.kind === "correction" ? (
        <BedtimeCorrectionPanel
          correction={result.action.data}
          isPumpUser={isPumpUser}
          hoursUntilSleep={hoursUntilSleep}
          variant="compact"
        />
      ) : null}

      {result.action.kind === "missing_isf" ? (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3.5 text-sm dark:bg-amber-950/30"
          data-testid="card-correction-unavailable"
        >
          <p className="font-medium text-foreground">Above target — dose not calculated</p>
          <p className="mt-1 text-muted-foreground">
            Add your correction factor in Settings → Ratios so we can suggest a bedtime dose, or follow your usual
            team plan.
          </p>
          <Button variant="link" size="sm" className="mt-1 h-auto px-0" asChild>
            <Link href="/settings/ratios">Open ratios settings</Link>
          </Button>
        </div>
      ) : null}

      {result.action.kind === "dose_too_small" ? (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3.5 text-sm dark:bg-amber-950/30"
          data-testid="card-correction-too-small"
        >
          <p className="font-medium text-foreground">
            Correction would be under {"\u00BD"}u — likely too small to dose precisely
          </p>
          <p className="mt-1 text-muted-foreground">{result.action.note}</p>
        </div>
      ) : null}

      {result.action.kind === "snack" ? (
        <div className="overflow-hidden rounded-[1.35rem] border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-card to-card px-4 py-4 shadow-[0_12px_40px_-24px_rgba(245,158,11,0.4)] dark:from-amber-950/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Suggested snack</p>
          <p className="mt-1.5 font-display text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {result.action.grams}
            <span className="ml-0.5 text-lg font-semibold text-muted-foreground">g</span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{result.action.reason}</p>
        </div>
      ) : null}

      {result.action.kind !== "correction" && topGuidance.length > 0 ? (
        <div className="rounded-[1.35rem] border border-border/50 bg-card/70 px-4 py-3.5 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Next steps</p>
          <ul className="mt-2.5 space-y-2.5" aria-label="Bedtime guidance">
            {topGuidance.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" aria-hidden />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
          {extraGuidanceCount > 0 ? (
            <p className="mt-2.5 text-xs text-muted-foreground">
              +{extraGuidanceCount} more in full breakdown
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-between rounded-xl border-border/50 bg-card/80"
        onClick={() => setDetailsOpen(true)}
        data-testid="button-open-details-top"
      >
        <span className="font-medium">Full breakdown</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-5 sm:px-6">
          <SheetHeader className="text-left">
            <SheetTitle>Bedtime breakdown</SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            {result.guidance.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All guidance</h3>
                <ol className="space-y-2">
                  {result.guidance.map((line, i) => (
                    <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-0.5">{line}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {result.action.kind === "correction" ? (
              <section>
                <BedtimeCorrectionPanel
                  correction={result.action.data}
                  isPumpUser={isPumpUser}
                  hoursUntilSleep={hoursUntilSleep}
                  variant="details"
                />
              </section>
            ) : null}

            {result.tips.length > 0 ? (
              <section className="space-y-2" data-testid="container-bedtime-tips">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Tips for tonight
                </h3>
                <ul className="space-y-2">
                  {result.tips.map((tip, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed"
                      data-testid={`text-tip-${i}`}
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {isPumpUser && (result.level === "monitor" || result.level === "alert") ? (
              <section className="space-y-2 rounded-xl border border-border/60 bg-card px-4 py-3" data-testid="card-pump-overnight">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Syringe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                  Pump overnight tips
                </h3>
                <div className="space-y-2 text-sm text-foreground/90">
                  {exercisedToday && !loopOn ? (
                    <p data-testid="text-pump-post-exercise">
                      {(() => {
                        const last = storage.getLastExerciseSummary();
                        const tier =
                          last && storage.didExerciseRecently(24) ? inferPostExerciseLoadTier(last) : "moderate";
                        const suffix = lastExerciseLabel ? ` (${lastExerciseLabel})` : "";
                        return getPumpBedtimePostExerciseLine(tier, suffix);
                      })()}
                    </p>
                  ) : null}
                  {exercisedToday && loopOn ? (
                    <p data-testid="text-pump-post-exercise">
                      After exercise, delayed lows are still common on closed loop. Let automation work and plan an extra check rather than stacking a manual basal cut.
                    </p>
                  ) : null}
                  {hadAlcohol && !loopOn ? (
                    <p>Alcohol can cause delayed lows. Consider reducing basal by 10–20% overnight and setting an alarm.</p>
                  ) : null}
                  {hadAlcohol && loopOn ? (
                    <p>Alcohol can cause delayed lows. Let the loop work and plan an extra check — don&apos;t stack a manual basal cut on automation unless your team says to.</p>
                  ) : null}
                  {loopOn ? (
                    <p data-testid="text-pump-closed-loop-overnight">{closedLoopSafetyNote("bedtime", { usesClosedLoop: true })}</p>
                  ) : (
                    <p>If your BG is trending down, a small temporary basal reduction (80–90%) may help prevent an overnight low.</p>
                  )}
                </div>
              </section>
            ) : null}

            {!isPumpUser && (result.level === "monitor" || result.level === "alert") && exercisedToday ? (
              <section className="space-y-2 rounded-xl border border-border/60 bg-card px-4 py-3" data-testid="card-mdi-post-exercise">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Syringe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                  After exercise (MDI)
                </h3>
                <p className="text-sm text-foreground/90">
                  {(() => {
                    const last = storage.getLastExerciseSummary();
                    const tier = last && storage.didExerciseRecently(24) ? inferPostExerciseLoadTier(last) : "moderate";
                    return getMdiBedtimePostExerciseLine(tier);
                  })()}
                </p>
              </section>
            ) : null}

            <section className="space-y-3" data-testid="card-bedtime-factors">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why we said this</h3>
              <div className="grid gap-2 sm:grid-cols-2" data-testid="container-bedtime-factors">
                {result.factors.map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/80 px-3 py-3"
                    data-testid={`card-factor-${i}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon status={factor.status} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground" data-testid={`text-factor-label-${i}`}>
                        {factor.label}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/90" data-testid={`text-factor-note-${i}`}>
                        {factor.note}
                      </p>
                      {factor.detail ? (
                        <p className="text-xs leading-relaxed text-muted-foreground" data-testid={`text-factor-detail-${i}`}>
                          {factor.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
