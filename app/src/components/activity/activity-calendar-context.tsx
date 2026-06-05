import { createContext, useContext } from "react";

import type { StreakTrackKind } from "@/lib/activity-streaks";
import type { ScenarioCalendarDayMap } from "@/lib/scenario-calendar";

export type HabitDayKeys = Partial<Record<StreakTrackKind, Set<string>>>;

export type ActivityCalendarContextValue = {
  scenarioDays: ScenarioCalendarDayMap;
  activityDayKeys: Set<string>;
  /** Per-habit qualifying days for dual markers (bedtime + exercise in v1). */
  habitDayKeys: HabitDayKeys;
  /** Days in the active streak run for the selected filter (optional highlight). */
  streakRunDayKeys: Set<string>;
};

export const ActivityCalendarContext = createContext<ActivityCalendarContextValue | null>(null);

export function useActivityCalendarContext(): ActivityCalendarContextValue | null {
  return useContext(ActivityCalendarContext);
}
