import { useMemo, useState, type ReactNode } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { storage } from "@/lib/storage";
import { computePatternInsights, type PatternInsightTone } from "@/lib/insights/pattern-insights";
import { dismissPatternInsight, listDismissedPatternInsightIds } from "@/lib/insights/insights-dismiss";

const TONE_ICONS: Record<PatternInsightTone, ReactNode> = {
  attention: <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
  positive: <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
  neutral: <Info className="h-4 w-4 text-muted-foreground" />,
};

export function PatternInsightsWidget(_props: DashboardWidgetLayoutProps) {
  const [dismissTick, setDismissTick] = useState(0);

  const insights = useMemo(
    () =>
      computePatternInsights(
        {
          hypos: storage.getHypoTreatments(),
          exerciseOutcomes: storage.getExerciseOutcomes(),
        },
        2,
      ),
    [],
  );

  const visibleInsights = useMemo(() => {
    const dismissed = new Set(listDismissedPatternInsightIds());
    return insights.filter((i) => !dismissed.has(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights, dismissTick]);

  const handleDismiss = (id: string) => {
    dismissPatternInsight(id);
    setDismissTick((t) => t + 1);
  };

  if (visibleInsights.length === 0) return null;

  return (
    <WidgetCard data-testid="widget-pattern-insights">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
          <CardTitle className="text-h3 text-foreground">Your patterns</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:px-6 md:pb-6 space-y-2">
        {visibleInsights.map((insight) => (
          <div
            key={insight.id}
            data-testid="pattern-insight-row"
            className="flex items-start gap-2.5 rounded-lg bg-muted/25 px-3 py-2.5"
          >
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {TONE_ICONS[insight.tone]}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{insight.title}</p>
              <p className="text-sm leading-relaxed text-foreground">{insight.body}</p>
              {insight.actionLabel && insight.actionHref ? (
                <Link
                  href={insight.actionHref}
                  className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                >
                  {insight.actionLabel}
                </Link>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 -mr-1"
              aria-label="Dismiss insight"
              onClick={() => handleDismiss(insight.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Link
          href="/tools/patterns"
          className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          data-testid="link-view-all-patterns"
        >
          View all patterns
        </Link>
      </CardContent>
    </WidgetCard>
  );
}
