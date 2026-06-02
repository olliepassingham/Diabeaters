import { storage, type ScenarioState, type Supply } from "@/lib/storage";

/** Matches the dashboard header status pill (`StatusPill`). */
export type HealthStatus = "stable" | "watch" | "action";

export function getHealthStatus(supplies: Supply[], scenarioState: ScenarioState): HealthStatus {
  const supplyStatuses = supplies.map((s) => storage.getSupplyStatus(s));
  const hasCritical = supplyStatuses.includes("critical");
  const hasLow = supplyStatuses.includes("low");

  const bothActive = scenarioState.sickDayActive && scenarioState.travelModeActive;

  if (bothActive) {
    return "action";
  }

  if (scenarioState.sickDayActive && scenarioState.sickDaySeverity === "severe") {
    return "action";
  }

  if (hasCritical) {
    return "action";
  }

  if (hasLow || scenarioState.sickDayActive) {
    return "watch";
  }

  return "stable";
}

/** Today card headline — same inputs as `getHealthStatus`, expanded into copy + tone. */
export type TodayGlanceStatusType = "ok" | "info" | "warning";

export function getTodayGlanceLine(
  supplies: Supply[],
  scenarioState: ScenarioState,
): { type: TodayGlanceStatusType; message: string } {
  const h = getHealthStatus(supplies, scenarioState);
  const hasCritical = supplies.some((s) => storage.getSupplyStatus(s) === "critical");
  const hasLow = supplies.some((s) => storage.getSupplyStatus(s) === "low");

  if (h === "action") {
    if (scenarioState.sickDayActive && scenarioState.travelModeActive) {
      return {
        type: "warning",
        message: "Sick day and travel mode are both active — review your plan with your team if unsure.",
      };
    }
    if (scenarioState.sickDayActive && scenarioState.sickDaySeverity === "severe") {
      return {
        type: "warning",
        message: "Severe sick day mode — follow your clinic plan and seek help if symptoms worsen.",
      };
    }
    if (hasCritical) {
      return { type: "warning", message: "Critical supplies need attention" };
    }
    return {
      type: "warning",
      message: "Action may be needed — review supplies and active guides.",
    };
  }

  if (h === "watch") {
    if (hasLow) {
      return { type: "info", message: "Some supplies are running low" };
    }
    if (scenarioState.sickDayActive) {
      return { type: "info", message: "Sick day mode active" };
    }
  }

  if (scenarioState.travelModeActive) {
    return {
      type: "info",
      message: `Travel mode active${scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ""}`,
    };
  }

  return { type: "ok", message: "All clear for now" };
}

/**
 * Hero and Today both use {@link getTodayGlanceLine}; for stock-only info/warnings the Today
 * card already surfaces the same copy — skip the hero glance line to avoid repetition.
 */
export function shouldOmitHeroGlanceLineDuplicatingTodayCard(
  glance: { type: TodayGlanceStatusType; message: string },
  supplies: Supply[],
  scenarioState?: ScenarioState,
): boolean {
  const hasLow = supplies.some((s) => storage.getSupplyStatus(s) === "low");
  const hasCritical = supplies.some((s) => storage.getSupplyStatus(s) === "critical");
  if (glance.type === "info" && glance.message === "Some supplies are running low" && hasLow) {
    return true;
  }
  if (glance.type === "warning" && glance.message === "Critical supplies need attention" && hasCritical) {
    return true;
  }
  if (scenarioState?.travelModeActive && /^travel mode active/i.test(glance.message)) {
    return true;
  }
  return false;
}

/**
 * Hide the Today card status banner when the hero already signals the same urgency
 * (StatusPill + optional hero glance line).
 */
export function shouldOmitTodayCardGlanceBanner(
  glance: { type: TodayGlanceStatusType; message: string },
  supplies: Supply[],
  scenarioState: ScenarioState,
  healthStatus: HealthStatus,
): boolean {
  if (shouldOmitHeroGlanceLineDuplicatingTodayCard(glance, supplies, scenarioState)) {
    return true;
  }

  if (healthStatus === "action" && glance.type === "warning") {
    const hasCritical = supplies.some((s) => storage.getSupplyStatus(s) === "critical");
    if (hasCritical && glance.message === "Critical supplies need attention") return true;
    if (scenarioState.sickDayActive && scenarioState.sickDaySeverity === "severe") return true;
    if (scenarioState.sickDayActive && scenarioState.travelModeActive) return true;
    if (glance.message.startsWith("Action may be needed")) return true;
  }

  if (healthStatus === "watch" && glance.type === "info" && scenarioState.sickDayActive) {
    if (glance.message === "Sick day mode active") return true;
  }

  return false;
}
