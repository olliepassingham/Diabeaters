import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { storage, type SickDayMedicationLogEntry } from "@/lib/storage";

function notificationIdForReminder(id: string): number {
  const hex = id.replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? (n % 2_000_000_000) : Math.floor(Math.random() * 1_000_000_000);
}

export async function scheduleSickDayMedReminder(entry: SickDayMedicationLogEntry): Promise<{
  scheduled: boolean;
  permission?: "granted" | "denied";
}> {
  if (!Capacitor.isNativePlatform()) return { scheduled: false };

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") {
    return { scheduled: false, permission: perm.display === "denied" ? "denied" : "denied" };
  }

  const at = new Date(entry.nextDueAtIso);
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() + 30_000) {
    return { scheduled: false, permission: "granted" };
  }

  const id = notificationIdForReminder(entry.id);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // ignore
  }

  const title = "Medication reminder";
  const when = at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const dose = entry.doseLabel ? ` · ${entry.doseLabel}` : "";
  const body = `${entry.name}${dose} · due ${when}`;

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at },
        extra: {
          kind: "sick_day_med_reminder",
          reminder_id: entry.id,
          deep_link: "/sick-day#sickday-checklist",
        },
      },
    ],
  });

  return { scheduled: true, permission: "granted" };
}

export async function cancelSickDayMedReminder(entryId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const id = notificationIdForReminder(entryId);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // ignore
  }
}

/** Re-schedule OS local notifications for all active sick-day med reminders (e.g. after app resume). */
export async function rescheduleAllSickDayNativeMedReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const sc = storage.getScenarioState();
  if (!sc.sickDayActive) return;
  const meds = storage.getSickDayMedicationLog().filter((e) => !e.dismissedAtIso);
  for (const e of meds) {
    await scheduleSickDayMedReminder(e);
  }
}

