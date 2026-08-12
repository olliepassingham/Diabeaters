import { Link } from "wouter";
import { AlertCircle, CheckCircle2, Droplet, IdCard, Phone, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import type { DrivingReadinessOutcome } from "@/lib/driving-readiness-tool";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  not_ready: {
    hero: "from-destructive/20 via-destructive/8 to-background",
    border: "border-destructive/45",
    accent: "text-destructive",
    doNow: "border-destructive/30 bg-destructive/10",
    doNowLabel: "text-destructive",
  },
  caution: {
    hero: "from-amber-500/25 via-amber-500/10 to-background dark:from-amber-950/40 dark:via-amber-950/20",
    border: "border-amber-500/45",
    accent: "text-amber-800 dark:text-amber-200",
    doNow: "border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/35",
    doNowLabel: "text-amber-900 dark:text-amber-100",
  },
  likely_ok: {
    hero: "from-emerald-500/20 via-emerald-500/8 to-background dark:from-emerald-950/35 dark:via-emerald-950/15",
    border: "border-emerald-600/35",
    accent: "text-emerald-800 dark:text-emerald-200",
    doNow: "border-primary/25 bg-primary/8",
    doNowLabel: "text-primary",
  },
} as const;

function OutcomeBadge({ outcome }: { outcome: DrivingReadinessOutcome }) {
  if (outcome.kind === "not_ready") {
    return <Badge variant="destructive">Not ready</Badge>;
  }
  if (outcome.kind === "caution") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/70 bg-amber-500/15 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
      >
        Caution
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-600/50 bg-emerald-500/15 font-medium text-emerald-950 dark:text-emerald-50"
    >
      Likely OK
    </Badge>
  );
}

function parseReadingSummary(summary: string | undefined): { value: string; trend: string | null } | null {
  if (!summary) return null;
  const parts = summary.split(" · ");
  if (parts.length >= 2) {
    return { value: parts[0]!, trend: parts.slice(1).join(" · ") };
  }
  return { value: summary, trend: null };
}

function ActionRow({
  href,
  icon: Icon,
  label,
  testId,
}: {
  href: string;
  icon: typeof Droplet;
  label: string;
  testId: string;
}) {
  return (
    <Button variant="secondary" size="default" className="h-11 w-full justify-center gap-2 rounded-xl" asChild>
      <Link href={href} data-testid={testId}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}

export function DrivingResultCard({
  outcome,
  onReset,
  linkWithFrom,
}: {
  outcome: DrivingReadinessOutcome;
  onReset: () => void;
  linkWithFrom: (path: string) => string;
}) {
  const tone = TONE_STYLES[outcome.kind];
  const reading = parseReadingSummary(outcome.readingSummary);
  const hasLinks = outcome.links.hypoHelp || outcome.links.emergencyCard || outcome.links.helpNow;
  const linkCount = [outcome.links.hypoHelp, outcome.links.emergencyCard, outcome.links.helpNow].filter(Boolean).length;

  return (
    <Card
      className={cn("surface-card overflow-hidden border shadow-sm", tone.border)}
      data-testid="driving-result-card"
    >
      <div className={cn("bg-gradient-to-b px-4 pb-3 pt-4", tone.hero)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <OutcomeBadge outcome={outcome} />
          <div className="flex shrink-0 items-center gap-0.5">
            <InlineInfoHint
              ariaLabel="Driving check details and limits"
              className="h-9 w-9"
              content={
                <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed">
                  {outcome.detailsForInfo.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={onReset}
              aria-label="Start over"
              data-testid="button-driving-start-over"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-foreground">
          {outcome.headline}
        </h2>

        {reading ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-baseline gap-1.5 rounded-xl border border-border/50 bg-background/70 px-3.5 py-2 shadow-sm">
              <span className="text-2xl font-bold tabular-nums leading-none text-foreground">{reading.value}</span>
              {reading.trend ? (
                <span className="text-xs font-medium capitalize text-muted-foreground">{reading.trend}</span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <CardContent className="space-y-3 px-4 pb-4 pt-3">
        <p className="text-sm leading-relaxed text-muted-foreground">{outcome.lead}</p>

        {outcome.doNow.length > 0 ? (
          <div className={cn("rounded-xl border px-3 py-3", tone.doNow)}>
            <p className={cn("mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider", tone.doNowLabel)}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Do now
            </p>
            <ul className="space-y-2.5">
              {outcome.doNow.map((b) => (
                <li key={b} className="text-sm font-medium leading-snug text-foreground">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {outcome.beforeYouGo.length > 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {outcome.doNow.length > 0 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Before you go
                </>
              ) : (
                "Keep in mind"
              )}
            </p>
            <ul className="space-y-2">
              {outcome.beforeYouGo.map((b) => (
                <li key={b} className="text-sm leading-relaxed text-muted-foreground">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {outcome.kind === "likely_ok" ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{outcome.disclaimer}</p>
        ) : null}

        {hasLinks ? (
          <div
            className={cn(
              "grid gap-2 pt-1",
              linkCount >= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            {outcome.links.hypoHelp ? (
              <ActionRow
                href={linkWithFrom("/tools/hypo-help")}
                icon={Droplet}
                label="Hypo help"
                testId="driving-link-hypo"
              />
            ) : null}
            {outcome.links.emergencyCard ? (
              <ActionRow
                href={linkWithFrom("/emergency-card")}
                icon={IdCard}
                label="Emergency card"
                testId="driving-link-emergency"
              />
            ) : null}
            {outcome.links.helpNow ? (
              <ActionRow
                href={linkWithFrom("/help-now")}
                icon={Phone}
                label="Help now"
                testId="driving-link-help"
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
