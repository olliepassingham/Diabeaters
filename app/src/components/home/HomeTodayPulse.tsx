import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, Package } from "lucide-react";
import { Link } from "wouter";

import {
  getTodayGlanceLine,
  shouldOmitTodayCardGlanceBanner,
  type HealthStatus,
} from "@/lib/dashboard-health-status";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  DIABEATER_SUPPLIES_CHANGED_EVENT,
  storage,
  type ScenarioState,
  type Supply,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Quiet home status strip — only when something useful remains after
 * hero / runway / next-up already own bedtime, travel, and stock.
 */
export function HomeTodayPulse({
  healthStatus,
  suppressRunwayDuplicate = false,
}: {
  healthStatus: HealthStatus;
  suppressRunwayDuplicate?: boolean;
}) {
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    };
  }, []);

  const glance = useMemo(
    () => getTodayGlanceLine(supplies, scenarioState),
    [supplies, scenarioState],
  );

  const hideBanner =
    shouldOmitTodayCardGlanceBanner(glance, supplies, scenarioState, healthStatus) ||
    (suppressRunwayDuplicate && /shortest runway/i.test(glance.message));

  const emptySupplies = supplies.length === 0;
  const show = emptySupplies || !hideBanner;

  if (!show) return null;

  const tone = emptySupplies ? "info" : glance.type;
  const message = emptySupplies ? "Add supplies to track stock and runway" : glance.message;
  const href =
    emptySupplies || /supplies|stock|runway|reorder/i.test(message)
      ? "/supplies"
      : scenarioState.sickDayActive
        ? "/scenarios/sick-day"
        : scenarioState.travelModeActive
          ? "/scenarios/travel"
          : "/supplies";

  const Icon =
    tone === "warning" ? AlertCircle : tone === "info" ? (emptySupplies ? Package : AlertTriangle) : CheckCircle;

  return (
    <section
      className={cn(
        "animate-fade-in-up py-1",
        "-mx-4 w-[calc(100%+2rem)] md:-mx-6 md:w-[calc(100%+3rem)]",
      )}
      style={{ animationDelay: "80ms" }}
      data-testid="dashboard-today-overview-card"
    >
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 border-y px-4 py-2.5 md:px-6",
          "transition-colors hover:bg-background/40",
          tone === "warning" && "border-red-500/25 bg-red-500/[0.05] dark:bg-red-950/20",
          tone === "info" && "border-amber-500/25 bg-amber-500/[0.05] dark:bg-amber-950/15",
          tone === "ok" && "border-border/40 bg-muted/20 dark:bg-muted/10",
        )}
        data-testid="dashboard-today-inline"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            tone === "warning" && "bg-red-500/15 text-red-600 dark:text-red-400",
            tone === "info" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            tone === "ok" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span
          className="min-w-0 flex-1 text-sm leading-snug font-medium text-foreground"
          data-testid="text-today-status"
        >
          {message}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}
