import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Moon, Sparkles } from "lucide-react";
import { Link } from "wouter";

import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
  type BedtimeLog,
} from "@/lib/storage";
import {
  findMorningHomeBedtimeLog,
  bedtimeReadinessLabel,
  toBedtimeStreakDayKey,
} from "@/lib/bedtime-overnight-window";
import {
  computeOvernightSummaryFromLocalHistory,
  overnightTirTone,
} from "@/lib/bedtime-overnight-analysis";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import type { BgUnits } from "@/lib/cgm/types";
import { cn } from "@/lib/utils";

function isEveningWindow(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 19 || hour < 6;
}

function tonightAlreadyChecked(logs: BedtimeLog[], now: Date): boolean {
  const todayKey = toBedtimeStreakDayKey(now.toISOString());
  if (!todayKey) return false;
  return logs.some((log) => toBedtimeStreakDayKey(log.date, log.hoursUntilSleep) === todayKey);
}

export type HomeBedtimePresence =
  | { visible: false }
  | {
      visible: true;
      mode: "evening" | "morning";
      checkedTonight: boolean;
      morningLog: BedtimeLog | null;
      overnightTirPercent: number | null;
      tirTone: "good" | "ok" | "low" | null;
    };

export function useHomeBedtimePresence(): HomeBedtimePresence {
  const [now, setNow] = useState(() => new Date());
  const [logs, setLogs] = useState<BedtimeLog[]>(() => storage.getBedtimeLogs());

  useEffect(() => {
    const refresh = () => {
      setNow(new Date());
      setLogs(storage.getBedtimeLogs());
    };
    const timer = window.setInterval(refresh, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const evening = isEveningWindow(now);
  const morningLog = useMemo(
    () => (!evening ? findMorningHomeBedtimeLog(logs, now.getTime()) : null),
    [evening, logs, now],
  );

  const overnightTirPercent = useMemo(() => {
    if (!morningLog) return null;
    if (typeof morningLog.overnightCgmSummary?.inRangePercent === "number") {
      return morningLog.overnightCgmSummary.inRangePercent;
    }
    const points = getCgmLocalHistory();
    if (points.length === 0) return null;
    const units: BgUnits = morningLog.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
    const { low, high } = resolveUserTargetBgRange(storage.getSettings(), units);
    const summary = computeOvernightSummaryFromLocalHistory(morningLog, points, low, high, units);
    return summary?.inRangePercent ?? null;
  }, [morningLog]);

  if (evening) {
    return {
      visible: true,
      mode: "evening",
      checkedTonight: tonightAlreadyChecked(logs, now),
      morningLog: null,
      overnightTirPercent: null,
      tirTone: null,
    };
  }

  if (!morningLog) return { visible: false };

  return {
    visible: true,
    mode: "morning",
    checkedTonight: false,
    morningLog,
    overnightTirPercent,
    tirTone: overnightTirPercent == null ? null : overnightTirTone(overnightTirPercent),
  };
}

/**
 * Renders bedtime UI from a known visible presence (no extra subscriptions).
 */
export function HomeBedtimeMomentCard({
  presence,
}: {
  presence: Extract<HomeBedtimePresence, { visible: true }>;
}) {
  if (presence.mode === "evening") {
    const checkedTonight = presence.checkedTonight;
    return (
      <Link
        href="/scenarios/bedtime"
        className={cn(
          "group relative block overflow-hidden rounded-[1.35rem] outline-none ring-offset-background",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          checkedTonight
            ? "bg-gradient-to-br from-indigo-500/[0.10] via-background/80 to-violet-500/[0.06] ring-1 ring-indigo-500/15"
            : "bg-gradient-to-br from-indigo-600/[0.16] via-indigo-500/[0.08] to-violet-500/[0.10] ring-1 ring-indigo-500/25 shadow-[0_16px_36px_-28px_rgba(79,70,229,0.65)]",
        )}
        data-testid="home-bedtime-moment"
        aria-label={checkedTonight ? "Bedtime check done — open review" : "Start bedtime check"}
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-24 w-24 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="relative flex items-center gap-3 px-4 py-3.5">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
              checkedTonight ? "bg-indigo-500/80" : "bg-gradient-to-br from-indigo-500 to-violet-600",
            )}
          >
            <Moon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700/85 dark:text-indigo-300/90">
              {checkedTonight ? (
                <>
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Tonight · done
                </>
              ) : (
                <>
                  <Moon className="h-3 w-3" aria-hidden />
                  Tonight
                </>
              )}
            </span>
            <span className="mt-0.5 block font-display text-lg font-semibold tracking-tight text-foreground">
              {checkedTonight ? "Bedtime check logged" : "Bedtime check"}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {checkedTonight
                ? "Open to review glucose, food, and overnight readiness."
                : "A quick readiness check before you sleep — glucose, food, and insulin."}
            </span>
          </span>
          <span
            className={cn(
              "flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-transform group-hover:translate-x-0.5",
              checkedTonight
                ? "bg-background/70 text-foreground ring-1 ring-border/50"
                : "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500",
            )}
          >
            {checkedTonight ? "Review" : "Start"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </Link>
    );
  }

  const { morningLog, overnightTirPercent, tirTone } = presence;
  if (!morningLog) return null;
  const readiness = bedtimeReadinessLabel(morningLog.readinessLevel);

  return (
    <Link
      href="/scenarios/bedtime"
      className={cn(
        "group relative block overflow-hidden rounded-[1.35rem] outline-none ring-offset-background",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        tirTone === "low"
          ? "bg-gradient-to-br from-rose-500/[0.12] via-background/80 to-rose-500/[0.05] ring-1 ring-rose-500/20"
          : tirTone === "ok"
            ? "bg-gradient-to-br from-amber-500/[0.12] via-background/80 to-amber-500/[0.05] ring-1 ring-amber-500/20"
            : "bg-gradient-to-br from-emerald-500/[0.12] via-background/80 to-teal-500/[0.06] ring-1 ring-emerald-500/20",
      )}
      data-testid="home-bedtime-moment"
      aria-label={
        overnightTirPercent == null
          ? "Last night — open bedtime review"
          : `Last night · ${overnightTirPercent}% in range overnight`
      }
    >
      <div className="relative flex items-center gap-3 px-4 py-3.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
            tirTone === "low" ? "bg-rose-500" : tirTone === "ok" ? "bg-amber-500" : "bg-emerald-600",
          )}
        >
          <Moon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Last night
          </span>
          <span className="mt-0.5 block font-display text-lg font-semibold tracking-tight text-foreground">
            {overnightTirPercent == null ? `${readiness} overnight` : `${overnightTirPercent}% in range`}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
            {overnightTirPercent == null
              ? "Open your bedtime review for patterns and tips."
              : `Readiness was ${readiness.toLowerCase()} · tap for overnight review`}
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}

/** Standalone bedtime moment (subscribes to storage itself). */
export function HomeBedtimeMoment() {
  const presence = useHomeBedtimePresence();
  if (!presence.visible) return null;
  return <HomeBedtimeMomentCard presence={presence} />;
}
