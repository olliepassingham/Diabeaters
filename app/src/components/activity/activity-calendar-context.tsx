import { createContext, useContext } from "react";

import type { ScenarioCalendarDayMap } from "@/lib/scenario-calendar";

export type ActivityCalendarContextValue = {
  scenarioDays: ScenarioCalendarDayMap;
  activityDayKeys: Set<string>;
};

export const ActivityCalendarContext = createContext<ActivityCalendarContextValue | null>(null);

export function useActivityCalendarContext(): ActivityCalendarContextValue | null {
  return useContext(ActivityCalendarContext);
}
