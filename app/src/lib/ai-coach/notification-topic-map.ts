import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import type { CoachTopicSlug } from "@/lib/ai-coach/topics";

function kindFromRow(row: InAppNotificationRow): string {
  const d = row.data;
  if (d && typeof d === "object" && "kind" in d && typeof (d as { kind?: unknown }).kind === "string") {
    return String((d as { kind: string }).kind);
  }
  return "";
}

/**
 * Maps an in-app notification payload kind to a coach topic for handoffs into the Dee chat flow.
 * Unknown kinds default to general (safe, educational).
 */
export function coachTopicForInAppNotification(row: InAppNotificationRow): CoachTopicSlug {
  const k = kindFromRow(row).toLowerCase();

  if (k.startsWith("feed_post_")) return "general";
  if (k === "dm_message" || k.startsWith("dm_")) return "general";
  if (k.includes("supply")) return "general";
  if (k.includes("sick_day") || k.includes("sickday")) return "sick-day";
  if (k.includes("pump_failure") || k.includes("pump-failure")) return "pump-failure";
  if (k.includes("alcohol")) return "alcohol";
  if (k.includes("hypo")) return "hypo";
  if (k.includes("travel")) return "travel";
  if (k.includes("exercise")) return "exercise";
  if (k.includes("follow")) return "general";

  return "general";
}
