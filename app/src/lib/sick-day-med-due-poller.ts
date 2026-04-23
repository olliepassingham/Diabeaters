import { Capacitor } from "@capacitor/core";

import { storage } from "@/lib/storage";
import { createSickDayMedInAppNotification } from "@/lib/sick-day-med-inapp";
import { rescheduleAllSickDayNativeMedReminders } from "@/lib/sick-day-med-reminders";

let runLock = false;

/**
 * While sick day mode is on, watch active medication reminders and:
 * - Insert an in-app notification when `nextDueAtIso` is reached (once per due cycle).
 * - Optionally show a browser notification on web if permission is already granted.
 * Dedupes with `lastInAppNotifiedDueAtIso` on the log entry (cleared when the user snoozes or logs taken).
 */
export async function runSickDayMedDueNotifier(): Promise<void> {
  if (runLock) return;
  runLock = true;
  try {
    const sc = storage.getScenarioState();
    if (!sc.sickDayActive) return;

    const now = Date.now();
    const meds = storage.getSickDayMedicationLog().filter((e) => !e.dismissedAtIso);

    for (const entry of meds) {
      const dueMs = new Date(entry.nextDueAtIso).getTime();
      if (!Number.isFinite(dueMs)) continue;
      if (now < dueMs) continue;
      if (entry.lastInAppNotifiedDueAtIso === entry.nextDueAtIso) continue;

      const when = new Date(entry.nextDueAtIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const dose = entry.doseLabel ? ` · ${entry.doseLabel}` : "";
      const overdue = now > dueMs + 60_000;
      const res = await createSickDayMedInAppNotification({
        title: "Medication due",
        body: overdue
          ? `${entry.name}${dose} · was due ${when} — tap to log or snooze`
          : `${entry.name}${dose} · due ${when}`,
        reminderId: entry.id,
        dueAtIso: entry.nextDueAtIso,
        name: entry.name,
        subtype: "due_time",
      });

      if (!res.ok) continue;

      storage.updateSickDayMedicationEntry(entry.id, { lastInAppNotifiedDueAtIso: entry.nextDueAtIso });

      if (!Capacitor.isNativePlatform() && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Medication due", {
            body: `${entry.name}${dose} · ${overdue ? `overdue (due ${when})` : `due ${when}`}`,
            tag: `sickday-med-${entry.id}-${entry.nextDueAtIso}`,
          });
        } catch {
          // ignore
        }
      }
    }
  } finally {
    runLock = false;
  }
}

export async function bootstrapSickDayMedRemindersOnForeground(): Promise<void> {
  await rescheduleAllSickDayNativeMedReminders();
  await runSickDayMedDueNotifier();
}
