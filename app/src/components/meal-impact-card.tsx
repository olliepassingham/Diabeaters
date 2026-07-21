import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { MealGlucoseImpactChart } from "@/components/meal-glucose-impact-chart";
import { Badge } from "@/components/ui/badge";
import type { MealImpactProfile } from "@/lib/meal-impact";
import { cn } from "@/lib/utils";

type MealImpactCardProps = {
  impact: MealImpactProfile;
  className?: string;
};

/** Meal impact prediction: pattern label, illustrative curve, and management tips. */
export function MealImpactCard({ impact, className }: MealImpactCardProps) {
  return (
    <div
      className={cn("space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-3.5 dark:bg-muted/10", className)}
      data-testid="meal-impact-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="text-sm font-semibold text-foreground" data-testid="meal-impact-pattern-label">
            {impact.patternLabel}
          </span>
        </div>
        <Badge variant="secondary" className="gap-1 whitespace-nowrap text-[11px]">
          <Clock className="h-3 w-3" aria-hidden />
          Peak {impact.peakWindowLabel}
        </Badge>
      </div>

      <MealGlucoseImpactChart profile={impact} data-testid="meal-impact-chart" />

      {impact.tailRisk ? (
        <div
          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
          data-testid="meal-impact-tail-risk-note"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>Possible delayed rise {impact.tailWindowLabel} — fat and protein slow this down.</span>
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {impact.managementTips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
