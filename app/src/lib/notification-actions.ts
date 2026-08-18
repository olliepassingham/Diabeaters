import { LocalNotifications } from "@capacitor/local-notifications";

import { supportsNativeLocalNotifications } from "@/lib/native-platform";

/**
 * Notification action buttons (Capacitor local notifications; on iOS the same
 * categories also apply to remote pushes that set `aps.category`).
 *
 * Buttons must be idempotent: users can tap them twice, or after the underlying
 * state has already moved on (check-in expired, med already logged).
 */

export const HYPO_CHECK_IN_ACTION_TYPE = "hypo_check_in";
export const SICK_DAY_MED_ACTION_TYPE = "sick_day_med_reminder";
export const BEDTIME_REMINDER_ACTION_TYPE = "bedtime_reminder";
export const EXERCISE_CGM_ALERT_ACTION_TYPE = "exercise_cgm_alert";

export const ACTION_HYPO_CHECK_IN_OK = "hypo_check_in_ok";
export const ACTION_SICK_DAY_MED_TAKEN = "sick_day_med_taken";
export const ACTION_BEDTIME_OPEN_GUIDE = "bedtime_open_guide";
export const ACTION_BEDTIME_NOT_TONIGHT = "bedtime_not_tonight";
export const ACTION_EXERCISE_OPEN_GUIDE = "exercise_open_guide";
export const ACTION_EXERCISE_SORTED_IT = "exercise_sorted_it";

let registered = false;

/** Register action button categories with the OS. Safe to call repeatedly. */
export async function registerNotificationActionTypes(): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;
  if (registered) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: HYPO_CHECK_IN_ACTION_TYPE,
          actions: [{ id: ACTION_HYPO_CHECK_IN_OK, title: "I'm OK" }],
        },
        {
          id: SICK_DAY_MED_ACTION_TYPE,
          actions: [{ id: ACTION_SICK_DAY_MED_TAKEN, title: "Taken" }],
        },
        {
          id: BEDTIME_REMINDER_ACTION_TYPE,
          actions: [
            { id: ACTION_BEDTIME_OPEN_GUIDE, title: "Open guide", foreground: true },
            { id: ACTION_BEDTIME_NOT_TONIGHT, title: "Not tonight" },
          ],
        },
        {
          id: EXERCISE_CGM_ALERT_ACTION_TYPE,
          actions: [
            { id: ACTION_EXERCISE_OPEN_GUIDE, title: "Open exercise", foreground: true },
            { id: ACTION_EXERCISE_SORTED_IT, title: "I’ve sorted it" },
          ],
        },
      ],
    });
    registered = true;
  } catch (e) {
    // Don't set registered — allow a later retry after permissions / plugin ready.
    console.warn("[notification_actions] registerActionTypes failed:", e);
  }
}

function stringField(extra: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!extra) return null;
  const v = extra[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Handle a notification action button tap.
 *
 * Returns `true` when the action was fully handled in the background and the
 * caller should NOT navigate; `false` when the caller should fall back to the
 * notification's deep link (default tap, "Open guide", or missing data).
 */
export async function handleNotificationButtonAction(
  actionId: string,
  extra: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  switch (actionId) {
    case ACTION_HYPO_CHECK_IN_OK: {
      const checkInId = stringField(extra, "check_in_id");
      if (!checkInId) return false;
      try {
        const { respondHypoCheckIn } = await import("@/lib/hypo-check-ins");
        await respondHypoCheckIn({ checkInId, response: "ok" });
      } catch {
        // Offline or already responded/expired — nothing more we can do from a background action.
      }
      return true;
    }
    case ACTION_SICK_DAY_MED_TAKEN: {
      const reminderId = stringField(extra, "reminder_id");
      if (!reminderId) return false;
      try {
        const { markSickDayMedicationTakenFromNotification } = await import("@/lib/sick-day-med-actions");
        await markSickDayMedicationTakenFromNotification(reminderId, stringField(extra, "due_at_iso"));
      } catch {
        // ignore — user can still log from the sick day page
      }
      return true;
    }
    case ACTION_BEDTIME_NOT_TONIGHT:
      // Dismiss quietly — the whole point is not opening the app.
      return true;
    case ACTION_EXERCISE_SORTED_IT: {
      try {
        const { fetchPendingHypoCheckIns, respondHypoCheckIn } = await import("@/lib/hypo-check-ins");
        const { data } = await fetchPendingHypoCheckIns();
        const latest = data[0];
        if (latest) {
          await respondHypoCheckIn({ checkInId: latest.id, response: "treating" });
        }
      } catch {
        // Offline or nothing pending — dismissing the alert is still the right outcome.
      }
      return true;
    }
    default:
      return false;
  }
}
