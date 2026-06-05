import { Moon, Dumbbell, Map as MapIcon, UtensilsCrossed, Sparkles, type LucideIcon } from "lucide-react";

import {
  computeStreakStats,
  computeStreakStatsFromDayKeys,
  qualifyingBalancedDayKeys,
  type StreakTrackKind,
} from "@/lib/activity-streaks";
import { collectAllActivityEvents, type ActivityEvent } from "@/lib/activity-history";

export type AchievementId =
  | "bedtime_streak_3"
  | "bedtime_streak_7"
  | "exercise_streak_3"
  | "exercise_streak_7"
  | "scenario_streak_3"
  | "scenario_streak_7"
  | "adviser_streak_3"
  | "adviser_streak_7"
  | "balanced_week";

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  streakKind: StreakTrackKind | "balanced";
  requiredDays: number;
  icon: LucideIcon;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "bedtime_streak_3",
    title: "Sleep check — 3 days",
    description: "Logged a bedtime check three days in a row.",
    streakKind: "bedtime_check",
    requiredDays: 3,
    icon: Moon,
  },
  {
    id: "bedtime_streak_7",
    title: "Sleep steady — 1 week",
    description: "Logged a bedtime check seven days in a row.",
    streakKind: "bedtime_check",
    requiredDays: 7,
    icon: Moon,
  },
  {
    id: "exercise_streak_3",
    title: "Moving — 3 days",
    description: "Logged exercise three days in a row.",
    streakKind: "exercise_session",
    requiredDays: 3,
    icon: Dumbbell,
  },
  {
    id: "exercise_streak_7",
    title: "Active week",
    description: "Logged exercise seven days in a row.",
    streakKind: "exercise_session",
    requiredDays: 7,
    icon: Dumbbell,
  },
  {
    id: "scenario_streak_3",
    title: "Guides — 3 days",
    description: "Used a guide three days in a row.",
    streakKind: "scenario_started",
    requiredDays: 3,
    icon: MapIcon,
  },
  {
    id: "scenario_streak_7",
    title: "Guide steady — 1 week",
    description: "Used a guide seven days in a row.",
    streakKind: "scenario_started",
    requiredDays: 7,
    icon: MapIcon,
  },
  {
    id: "adviser_streak_3",
    title: "Meal planner — 3 days",
    description: "Used meal planning three days in a row.",
    streakKind: "adviser_session",
    requiredDays: 3,
    icon: UtensilsCrossed,
  },
  {
    id: "adviser_streak_7",
    title: "Meal planner — 1 week",
    description: "Used meal planning seven days in a row.",
    streakKind: "adviser_session",
    requiredDays: 7,
    icon: UtensilsCrossed,
  },
  {
    id: "balanced_week",
    title: "Balanced week",
    description: "Logged both bedtime and exercise on the same day for seven days in a row.",
    streakKind: "balanced",
    requiredDays: 7,
    icon: Sparkles,
  },
];

const DEFINITION_BY_ID = new Map(ACHIEVEMENT_DEFINITIONS.map((d) => [d.id, d]));

export function getAchievementDefinition(id: AchievementId): AchievementDefinition {
  const def = DEFINITION_BY_ID.get(id);
  if (!def) throw new Error(`Unknown achievement: ${id}`);
  return def;
}

function streakMeetsMilestone(
  events: ActivityEvent[],
  def: AchievementDefinition,
  today: Date,
): boolean {
  if (def.streakKind === "balanced") {
    const stats = computeStreakStatsFromDayKeys(
      qualifyingBalancedDayKeys(events),
      "bedtime_check",
      today,
    );
    return stats.best >= def.requiredDays || stats.current >= def.requiredDays;
  }

  const stats = computeStreakStats(events, def.streakKind, today);
  return stats.best >= def.requiredDays || stats.current >= def.requiredDays;
}

export function evaluateNewlyUnlockedAchievements(
  events: ActivityEvent[],
  alreadyEarnedIds: Set<string>,
  today: Date = new Date(),
): AchievementId[] {
  const unlocked: AchievementId[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (alreadyEarnedIds.has(def.id)) continue;
    if (streakMeetsMilestone(events, def, today)) {
      unlocked.push(def.id);
    }
  }

  return unlocked;
}

export function evaluateAllUnlockedAchievements(
  events: ActivityEvent[] = collectAllActivityEvents(),
  today: Date = new Date(),
): AchievementId[] {
  return evaluateNewlyUnlockedAchievements(events, new Set(), today);
}
