import { Calendar, Moon, Dumbbell, Map as MapIcon, UtensilsCrossed, Sparkles, Trophy, Sprout, type LucideIcon } from "lucide-react";

import {
  computeStreakStats,
  computeStreakStatsFromDayKeys,
  qualifyingBalancedDayKeys,
  streakKindLabel,
  type StreakTrackKind,
} from "@/lib/activity-streaks";
import { collectAllActivityEvents, type ActivityEvent } from "@/lib/activity-history";
import {
  computeTenureDaysSinceOnset,
  DIABETES_TENURE_LONGEST_KIND,
  DIABETES_TENURE_SHORTEST_KIND,
  formatTenureBadgeLabel,
  isDiabetesTenureKind,
  type DiabetesTenureKind,
} from "@/lib/diabetes-tenure";

export type ProfileStreakKind = StreakTrackKind | "balanced" | DiabetesTenureKind;

const PROFILE_STREAK_KINDS: ProfileStreakKind[] = [
  "bedtime_check",
  "exercise_session",
  "scenario_started",
  "adviser_session",
  "app_check_in",
  "balanced",
  DIABETES_TENURE_LONGEST_KIND,
  DIABETES_TENURE_SHORTEST_KIND,
];

export function isProfileStreakKind(value: string): value is ProfileStreakKind {
  return (PROFILE_STREAK_KINDS as readonly string[]).includes(value);
}

const STREAK_KIND_ICONS: Record<ProfileStreakKind, LucideIcon> = {
  bedtime_check: Moon,
  exercise_session: Dumbbell,
  supply_event: Sparkles,
  appointment: Calendar,
  scenario_started: MapIcon,
  adviser_session: UtensilsCrossed,
  app_check_in: Calendar,
  balanced: Sparkles,
  [DIABETES_TENURE_LONGEST_KIND]: Trophy,
  [DIABETES_TENURE_SHORTEST_KIND]: Sprout,
};

export function profileStreakKindIcon(kind: ProfileStreakKind): LucideIcon {
  return STREAK_KIND_ICONS[kind];
}

export function profileStreakKindLabel(kind: ProfileStreakKind): string {
  if (kind === "balanced") return "Balanced";
  if (kind === DIABETES_TENURE_LONGEST_KIND) return "Community veteran";
  if (kind === DIABETES_TENURE_SHORTEST_KIND) return "Newest journey";
  return streakKindLabel(kind);
}

export function profileStreakTooltip(kind: ProfileStreakKind, days: number): string {
  if (isDiabetesTenureKind(kind)) {
    const tenure = formatTenureBadgeLabel(days);
    return kind === DIABETES_TENURE_LONGEST_KIND
      ? `Longest reported time with type 1 (${tenure})`
      : `Most recently reported type 1 diagnosis (${tenure})`;
  }
  const label = profileStreakKindLabel(kind);
  return days === 1 ? `1-day ${label.toLowerCase()} streak` : `${days}-day ${label.toLowerCase()} streak`;
}

export function profileStreakBadgeLabel(kind: ProfileStreakKind, days: number): string {
  if (isDiabetesTenureKind(kind)) return formatTenureBadgeLabel(days);
  return String(days);
}

export function computeProfileStreakDays(
  kind: ProfileStreakKind,
  events: ActivityEvent[] = collectAllActivityEvents(),
  today: Date = new Date(),
  onsetDate?: string | null,
): number {
  if (isDiabetesTenureKind(kind)) {
    return computeTenureDaysSinceOnset(onsetDate, today);
  }
  if (kind === "balanced") {
    return computeStreakStatsFromDayKeys(qualifyingBalancedDayKeys(events), "bedtime_check", today).current;
  }
  return computeStreakStats(events, kind, today).current;
}

export function computeAllProfileStreakDays(
  events: ActivityEvent[] = collectAllActivityEvents(),
  today: Date = new Date(),
  onsetDate?: string | null,
): Record<ProfileStreakKind, number> {
  const out = {} as Record<ProfileStreakKind, number>;
  for (const kind of PROFILE_STREAK_KINDS) {
    const days = computeProfileStreakDays(kind, events, today, onsetDate);
    if (days > 0) out[kind] = days;
  }
  return out;
}

export type AchievementId =
  | "bedtime_streak_3"
  | "bedtime_streak_7"
  | "exercise_streak_3"
  | "exercise_streak_7"
  | "scenario_streak_3"
  | "scenario_streak_7"
  | "adviser_streak_3"
  | "adviser_streak_7"
  | "balanced_week"
  | "app_check_in_streak_3"
  | "app_check_in_streak_7"
  | "diabetes_tenure_longest"
  | "diabetes_tenure_shortest";

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  streakKind: ProfileStreakKind;
  requiredDays: number;
  icon: LucideIcon;
  /** Granted server-side from community diagnosis dates — not evaluated from local activity. */
  communityAward?: boolean;
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
  {
    id: "app_check_in_streak_3",
    title: "Showing up — 3 days",
    description: "Opened Diabeaters three days in a row.",
    streakKind: "app_check_in",
    requiredDays: 3,
    icon: Calendar,
  },
  {
    id: "app_check_in_streak_7",
    title: "Showing up — 1 week",
    description: "Opened Diabeaters seven days in a row.",
    streakKind: "app_check_in",
    requiredDays: 7,
    icon: Calendar,
  },
  {
    id: "diabetes_tenure_longest",
    title: "Community veteran",
    description: "Longest type 1 journey among members who share a diagnosis date.",
    streakKind: DIABETES_TENURE_LONGEST_KIND,
    requiredDays: 0,
    icon: Trophy,
    communityAward: true,
  },
  {
    id: "diabetes_tenure_shortest",
    title: "Newest journey",
    description: "Most recent type 1 diagnosis among members who share a diagnosis date.",
    streakKind: DIABETES_TENURE_SHORTEST_KIND,
    requiredDays: 0,
    icon: Sprout,
    communityAward: true,
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
  if (isDiabetesTenureKind(def.streakKind)) {
    return false;
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
    if (def.communityAward) continue;
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
