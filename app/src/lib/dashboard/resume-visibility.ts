import type { TodayRailItem } from "@/lib/dashboard/today-rail";
import type { LastInteractionRecord } from "@/lib/last-interaction";

/** Hide resume when the Today rail already surfaces the same flow. */
export function shouldHideResumeForTodayRail(last: LastInteractionRecord, todayItems: TodayRailItem[]): boolean {
  const ids = new Set(todayItems.map((i) => i.id));
  switch (last.kind) {
    case "scenario:sick-day":
      return ids.has("sickday-med") || ids.has("scenario-sick");
    case "scenario:pump-failure":
      return ids.has("scenario-pump");
    case "scenario:alcohol":
      return ids.has("scenario-alcohol");
    case "scenario:travel":
      return ids.has("scenario-travel");
    case "scenario:exercise":
      return ids.has("scenario-exercise");
    default:
      return false;
  }
}
