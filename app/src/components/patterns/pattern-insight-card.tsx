import { AlertTriangle, CheckCircle2, ChevronRight, Info, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { PatternInsight, PatternInsightTone } from "@/lib/insights/pattern-insights";
import { cn } from "@/lib/utils";

const TONE: Record<
  PatternInsightTone,
  {
    Icon: typeof AlertTriangle;
    accent: string;
    iconWrap: string;
    metric: string;
  }
> = {
  attention: {
    Icon: AlertTriangle,
    accent: "bg-amber-500",
    iconWrap: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
    metric: "text-amber-800 dark:text-amber-300",
  },
  positive: {
    Icon: CheckCircle2,
    accent: "bg-emerald-500",
    iconWrap: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    metric: "text-emerald-800 dark:text-emerald-300",
  },
  neutral: {
    Icon: Info,
    accent: "bg-primary/70",
    iconWrap: "bg-primary/10 text-primary",
    metric: "text-foreground",
  },
};

type Props = {
  insight: PatternInsight;
  onDismiss?: (id: string) => void;
  compact?: boolean;
  className?: string;
};

export function PatternInsightCard({ insight, onDismiss, compact, className }: Props) {
  const tone = TONE[insight.tone];
  const ToneIcon = tone.Icon;

  return (
    <article
      data-testid="pattern-insight-row"
      className={cn(
        "relative overflow-hidden rounded-[1.15rem] border border-border/50 bg-card/80",
        className,
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", tone.accent)} aria-hidden />
      <div className={cn("pl-3.5 pr-3", compact ? "py-3" : "py-3.5")}>
        <div className="flex items-start gap-3">
          <span
            className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", tone.iconWrap)}
            aria-hidden
          >
            <ToneIcon className="h-4 w-4" />
          </span>
          <div className={cn("min-w-0 flex-1", onDismiss ? "pr-7" : "")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                  {insight.title}
                </p>
                {insight.metricHint ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{insight.metricHint}</p>
                ) : null}
              </div>
              {insight.metric ? (
                <p
                  className={cn(
                    "shrink-0 text-right text-lg font-semibold tabular-nums leading-none tracking-tight",
                    tone.metric,
                  )}
                >
                  {insight.metric}
                </p>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
            {insight.takeaway ? (
              <p className="mt-2 rounded-xl bg-muted/40 px-2.5 py-2 text-[13px] leading-relaxed text-foreground/90">
                <span className="font-medium text-foreground">
                  {insight.tone === "positive" ? "Keep in mind. " : insight.tone === "attention" ? "Worth trying. " : "Worth noting. "}
                </span>
                {insight.takeaway}
              </p>
            ) : null}
            {insight.actionLabel && insight.actionHref ? (
              <Link
                href={insight.actionHref}
                className="mt-2.5 inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {insight.actionLabel}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
          {onDismiss ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1.5 h-8 w-8 shrink-0 text-muted-foreground/70 hover:text-foreground"
              aria-label="Dismiss insight"
              onClick={() => onDismiss(insight.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
