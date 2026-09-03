import { Activity, AlertTriangle, ChevronDown, Clock, Sparkles } from "lucide-react";
import { MealGlucoseImpactChart } from "@/components/meal-glucose-impact-chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MealImpactProfile } from "@/lib/meal-impact";
import { cn } from "@/lib/utils";

type MealImpactCardProps = {
  impact: MealImpactProfile;
  className?: string;
};

/** Meal impact prediction: pattern label, illustrative curve, and management tips. */
export function MealImpactCard({ impact, className }: MealImpactCardProps) {
  const watchLabel = impact.tailRisk ? "Delayed rise" : "Main rise";
  const watchValue = impact.tailRisk ? impact.tailWindowLabel ?? "3–6 h later" : impact.peakWindowLabel;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary/[0.09] via-background/50 to-cyan-500/[0.07] p-4 ring-1 ring-primary/10",
        className,
      )}
      data-testid="meal-impact-card"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Expected meal pattern
          </p>
          <p className="truncate font-display text-xl font-semibold text-foreground" data-testid="meal-impact-pattern-label">
            {impact.patternLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-background/65 px-3 py-2.5 backdrop-blur-sm">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            Peak
          </span>
          <p className="mt-1 text-sm font-semibold text-foreground">{impact.peakWindowLabel}</p>
        </div>
        <div className="rounded-2xl bg-background/65 px-3 py-2.5 backdrop-blur-sm">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="h-3 w-3" aria-hidden />
            {watchLabel}
          </span>
          <p className="mt-1 text-sm font-semibold text-foreground">{watchValue}</p>
        </div>
      </div>

      <MealGlucoseImpactChart
        profile={impact}
        className="mt-2 [&_svg]:min-h-[130px]"
        data-testid="meal-impact-chart"
      />

      <div
        className={cn(
          "mt-1 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm",
          impact.tailRisk
            ? "bg-amber-500/10 text-amber-950 dark:text-amber-100"
            : "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
        )}
        data-testid={impact.tailRisk ? "meal-impact-tail-risk-note" : undefined}
      >
        {impact.tailRisk ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        ) : (
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        )}
        <p className="leading-snug">
          {impact.tailRisk
            ? "Fat or protein may delay part of the rise. Check again 3–5 hours after eating."
            : "Use your usual checks to see how this meal compares with the typical pattern."}
        </p>
      </div>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
          >
            Why this pattern?
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-2 px-2 pb-1 pt-1">
            {impact.managementTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
