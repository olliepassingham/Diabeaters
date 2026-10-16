import { Activity, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { BgUnits } from "@/lib/cgm/types";
import {
  resolveSickDayLiveBgNudge,
  type SickDayLiveBgCta,
  type SickDayLiveBgTone,
} from "@/lib/sick-day-live-bg";
import { cn } from "@/lib/utils";

function toneClasses(tone: SickDayLiveBgTone): string {
  if (tone === "urgent") return "border-red-500/30 bg-red-500/[0.06] dark:bg-red-950/25";
  if (tone === "watch") return "border-amber-500/30 bg-amber-500/[0.06] dark:bg-amber-950/20";
  if (tone === "info") return "border-sky-500/25 bg-sky-500/[0.05] dark:bg-sky-950/20";
  return "border-border/45 bg-muted/20 dark:bg-muted/10";
}

function TrendIcon({ trend }: { trend: string | null | undefined }) {
  if (trend === "rising") return <TrendingUp className="h-3.5 w-3.5" aria-hidden />;
  if (trend === "falling") return <TrendingDown className="h-3.5 w-3.5" aria-hidden />;
  return <Activity className="h-3.5 w-3.5" aria-hidden />;
}

type Props = {
  prefill: BgPrefillResult | null;
  loading: boolean;
  loggedBg: string;
  bgUnits: BgUnits;
  onUpdateReadings: () => void;
  onFocusKetones: () => void;
  className?: string;
};

export function SickDayLiveBgStrip({
  prefill,
  loading,
  loggedBg,
  bgUnits,
  onUpdateReadings,
  onFocusKetones,
  className,
}: Props) {
  const reading = prefill?.reading;
  const liveValue = reading?.value ?? (prefill?.fromCgm && prefill.value ? Number(prefill.value) : null);
  const liveUnits = reading?.units ?? bgUnits;
  const parsedLive =
    liveValue != null && Number.isFinite(liveValue)
      ? liveValue
      : prefill?.value && Number.isFinite(Number(prefill.value))
        ? Number(prefill.value)
        : null;
  const loggedNum = loggedBg.trim() ? Number(loggedBg) : NaN;

  if (loading && !prefill) {
    return (
      <div
        className={cn(
          "rounded-[1.35rem] border border-border/45 bg-muted/15 px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
        data-testid="sickday-live-bg-strip-loading"
      >
        Checking live glucose…
      </div>
    );
  }

  const nudge = resolveSickDayLiveBgNudge({
    liveValue: parsedLive,
    liveUnits,
    trend: reading?.trend ?? null,
    isStale: Boolean(reading?.isStale),
    hasLiveSource: Boolean(prefill?.fromCgm),
    loggedBg: Number.isFinite(loggedNum) ? loggedNum : null,
    loggedUnits: bgUnits,
  });

  if (!nudge) return null;

  const runCta = (cta: SickDayLiveBgCta) => {
    if (cta === "update" || cta === "ketones") {
      if (cta === "ketones") onFocusKetones();
      else onUpdateReadings();
      return;
    }
  };

  const ctaLabel =
    nudge.cta === "update"
      ? "Update readings"
      : nudge.cta === "ketones"
        ? "Log ketones"
        : nudge.cta === "connect"
          ? "Connect CGM"
          : null;

  return (
    <div
      className={cn(
        "rounded-[1.35rem] border px-4 py-3",
        toneClasses(nudge.tone),
        className,
      )}
      data-testid="sickday-live-bg-strip"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            nudge.tone === "urgent" && "bg-red-500/15 text-red-700 dark:text-red-300",
            nudge.tone === "watch" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
            nudge.tone === "info" && "bg-sky-500/15 text-sky-800 dark:text-sky-300",
            nudge.tone === "ok" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
          )}
        >
          <TrendIcon trend={reading?.trend} />
        </span>
        <div className="min-w-0 flex-1">
          {parsedLive != null ? (
            <p className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {formatTargetBgInput(parsedLive, liveUnits)}
              <span className="ml-1.5 text-sm font-medium text-muted-foreground">{liveUnits}</span>
            </p>
          ) : null}
          <p className={cn("text-sm font-semibold text-foreground", parsedLive != null && "mt-1.5")}>
            {nudge.title}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{nudge.detail}</p>
          {prefill?.source ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
              {prefill.source}
            </p>
          ) : null}
        </div>
      </div>

      {nudge.cta === "connect" ? (
        <Button asChild variant="outline" size="sm" className="mt-3 h-9 w-full rounded-xl">
          <Link href="/settings/cgm" data-testid="link-sickday-live-connect-cgm">
            {ctaLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      ) : nudge.cta && ctaLabel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-9 w-full rounded-xl"
          onClick={() => runCta(nudge.cta)}
          data-testid={`button-sickday-live-cta-${nudge.cta}`}
        >
          {ctaLabel}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
