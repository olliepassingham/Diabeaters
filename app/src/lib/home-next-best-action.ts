/**
 * Picks one calm “next best action” for the home hero.
 * Priority is clinical urgency first, then time-of-day usefulness.
 */

import type { HealthStatus } from "@/lib/dashboard-health-status";
import type { HomeMealMoment } from "@/lib/home-meal-moment";
import type { TravelPromoteResult } from "@/lib/status-bar-model";

export type HomeNextBestActionId =
  | "help_now"
  | "exercise"
  | "sick_day"
  | "pump_failure"
  | "travel"
  | "bedtime"
  | "meal"
  | "supplies"
  | "coach"
  | "adviser";

export type HomeNextBestAction = {
  id: HomeNextBestActionId;
  /** Primary button label */
  label: string;
  /** Short supporting line under the hero number / status */
  subline: string;
  href?: string;
  /** When true, hero should call onTreatedHypo / custom handlers instead of navigating. */
  kind: "link" | "hypo" | "help";
};

export type ResolveHomeNextBestActionInput = {
  healthStatus: HealthStatus;
  sickDayActive: boolean;
  pumpFailureActive: boolean;
  exerciseActive: boolean;
  travelPromote: TravelPromoteResult;
  travelModeActive: boolean;
  travelDestination?: string;
  /** Evening bedtime window and not yet checked tonight. */
  bedtimeDue: boolean;
  mealMoment: HomeMealMoment | null;
  mealDismissed: boolean;
  hasCriticalSupply: boolean;
  showCoach: boolean;
};

const MEAL_LABELS: Record<HomeMealMoment["slot"], string> = {
  breakfast: "Plan breakfast",
  lunch: "Plan lunch",
  dinner: "Plan dinner",
};

export function resolveHomeNextBestAction(input: ResolveHomeNextBestActionInput): HomeNextBestAction {
  if (input.healthStatus === "action") {
    return {
      id: "help_now",
      label: "Help Now",
      subline: "Something needs attention — open Help Now if you're unsure.",
      href: "/help-now",
      kind: "help",
    };
  }

  if (input.exerciseActive) {
    return {
      id: "exercise",
      label: "Continue exercise",
      subline: "Your workout session is still open.",
      href: "/scenarios/exercise",
      kind: "link",
    };
  }

  if (input.sickDayActive) {
    return {
      id: "sick_day",
      label: "Open sick day",
      subline: "Sick day is on — keep checks and the checklist close.",
      href: "/scenarios/sick-day",
      kind: "link",
    };
  }

  if (input.pumpFailureActive) {
    return {
      id: "pump_failure",
      label: "Open pump failure",
      subline: "Pump failure mode is active — follow your backup plan.",
      href: "/scenarios/pump-failure",
      kind: "link",
    };
  }

  if (input.travelModeActive && input.travelPromote.promoted) {
    const dest = input.travelDestination?.trim();
    const travelLabel =
      input.travelPromote.reason === "packing"
        ? "Finish packing"
        : input.travelPromote.reason === "homebound" || input.travelPromote.reason === "return_day"
          ? "Insulin times · homebound"
          : input.travelPromote.reason === "insulin_shift"
            ? "Check insulin times"
            : dest
              ? `Open travel · ${dest}`
              : "Open travel";
    const travelSub =
      input.travelPromote.reason === "packing"
        ? "A few packing items are still unchecked."
        : input.travelPromote.reason === "homebound" || input.travelPromote.reason === "return_day"
          ? "Shift long-acting back toward home local time."
          : input.travelPromote.reason === "insulin_shift"
            ? "Today’s long-acting clock is shifting — see Insulin times."
            : "Your trip is active — open travel for today’s focus.";
    return {
      id: "travel",
      label: travelLabel,
      subline: travelSub,
      href: "/scenarios/travel",
      kind: "link",
    };
  }

  if (input.bedtimeDue) {
    return {
      id: "bedtime",
      label: "Overnight readiness",
      subline: "A calm check of glucose, food, and insulin before sleep.",
      href: "/scenarios/bedtime",
      kind: "link",
    };
  }

  if (input.mealMoment && !input.mealDismissed) {
    return {
      id: "meal",
      label: MEAL_LABELS[input.mealMoment.slot],
      subline: `${input.mealMoment.timeLabel} — carbs and dose when you're ready.`,
      href: `/adviser?tab=meal&mealTime=${input.mealMoment.slot}&from=home`,
      kind: "link",
    };
  }

  if (input.hasCriticalSupply || input.healthStatus === "watch") {
    return {
      id: "supplies",
      label: "Check supplies",
      subline: input.hasCriticalSupply
        ? "A supply is critically low — reorder when you can."
        : "Something is on watch — a quick supply glance helps.",
      href: "/supplies",
      kind: "link",
    };
  }

  if (input.showCoach) {
    return {
      id: "coach",
      label: "Ask Beatie",
      subline: "Steady stretch — ask if anything feels off.",
      href: undefined, // filled by caller with buildCoachHref
      kind: "link",
    };
  }

  return {
    id: "adviser",
    label: "Plan a meal",
    subline: "Steady stretch — open the adviser when you eat.",
    href: "/adviser?tab=meal&from=home",
    kind: "link",
  };
}

export type HomeHeroNarrativeInput = {
  healthStatus: HealthStatus;
  /** Display string already formatted for units, e.g. "6.2" */
  bgValue: string | null;
  bgUnits: string | null;
  trendLabel: "rising" | "falling" | "flat" | null;
  nextActionSubline: string;
};

export type HomeHeroNarrative = {
  /** Large hero number or short status word when no BG */
  primary: string;
  primarySuffix?: string;
  supporting: string;
};

/** Ultrahuman-style: one big number + one calm sentence. */
export function buildHomeHeroNarrative(input: HomeHeroNarrativeInput): HomeHeroNarrative {
  if (input.bgValue) {
    const trendBit =
      input.trendLabel === "rising"
        ? " trending up"
        : input.trendLabel === "falling"
          ? " trending down"
          : input.trendLabel === "flat"
            ? " holding steady"
            : "";
    return {
      primary: input.bgValue,
      primarySuffix: input.bgUnits ?? undefined,
      supporting: input.nextActionSubline || `Live glucose${trendBit}.`,
    };
  }

  if (input.healthStatus === "action") {
    return { primary: "Action", supporting: input.nextActionSubline };
  }
  if (input.healthStatus === "watch") {
    return { primary: "Watch", supporting: input.nextActionSubline };
  }
  return { primary: "Steady", supporting: input.nextActionSubline };
}
