import { Capacitor } from "@capacitor/core";

import { computeNextDueAfterReminderFired } from "@/lib/sick-day-med-schedule";
import { storage } from "@/lib/storage";
import { createSickDayMedInAppNotification } from "@/lib/sick-day-med-inapp";
import { rescheduleAllSickDayNativeMedReminders, scheduleSickDayMedReminder } from "@/lib/sick-day-med-reminders";

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
      const dueIso = entry.nextDueAtIso;
      const dueMs = new Date(dueIso).getTime();
      if (!Number.isFinite(dueMs)) continue;
      if (now < dueMs) continue;
      if (entry.lastInAppNotifiedDueAtIso === dueIso) continue;

      const when = new Date(dueIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const dose = entry.doseLabel ? ` · ${entry.doseLabel}` : "";
      const overdue = now > dueMs + 60_000;
      const res = await createSickDayMedInAppNotification({
        title: "Medication due",
        body: overdue
          ? `${entry.name}${dose} · was due ${when} — tap to log or snooze`
          : `${entry.name}${dose} · due ${when}`,
        reminderId: entry.id,
        dueAtIso: dueIso,
        name: entry.name,
        subtype: "due_time",
      });

      if (!res.ok) continue;

      const nextDueAtIso = computeNextDueAfterReminderFired(dueIso, entry.repeatEveryMinutes, now);
      storage.updateSickDayMedicationEntry(entry.id, { lastInAppNotifiedDueAtIso: dueIso, nextDueAtIso });
      const updated = storage.getSickDayMedicationLog().find((e) => e.id === entry.id);
      if (updated) {
        void scheduleSickDayMedReminder(updated);
      }

      if (!Capacitor.isNativePlatform() && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Medication due", {
            body: `${entry.name}${dose} · ${overdue ? `overdue (due ${when})` : `due ${when}`}`,
            tag: `sickday-med-${entry.id}-${dueIso}`,
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
