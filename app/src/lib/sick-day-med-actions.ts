import { computeNextDueAfterReminderFired } from "@/lib/sick-day-med-schedule";
import { createSickDayMedInAppNotification } from "@/lib/sick-day-med-inapp";
import { scheduleSickDayMedReminder } from "@/lib/sick-day-med-reminders";
import { storage, type SickDayMedicationDoseLogEntry } from "@/lib/storage";

/** Dispatched after a med dose is logged outside the sick-day page (e.g. notification action). */
export const SICK_DAY_MEDS_CHANGED_EVENT = "diabeater:sick-day-meds-changed";

/** Treat a second "Taken" tap within this window as a duplicate of the first. */
const DUPLICATE_TAKEN_WINDOW_MS = 10 * 60_000;

function notifySickDayMedsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SICK_DAY_MEDS_CHANGED_EVENT));
}

/**
 * Log a sick-day medication dose from a notification "Taken" button.
 *
 * Idempotent: repeated taps within {@link DUPLICATE_TAKEN_WINDOW_MS} do not
 * create duplicate dose entries. Next reminder is anchored to the due time
 * that fired (matching `runSickDayMedDueNotifier`), not the tap time.
 *
 * Returns true when a dose was logged (or the tap was a benign duplicate).
 */
export async function markSickDayMedicationTakenFromNotification(
  reminderId: string,
  firedDueAtIso?: string | null,
  now: Date = new Date(),
): Promise<boolean> {
  const entry = storage
    .getSickDayMedicationLog()
    .find((e) => e.id === reminderId && !e.dismissedAtIso);
  if (!entry) return false;

  const nowMs = now.getTime();

  const recentDuplicate = storage.getSickDayMedicationDoseLog().some((d) => {
    if (d.reminderId !== reminderId) return false;
    const t = new Date(d.takenAtIso).getTime();
    return Number.isFinite(t) && Math.abs(nowMs - t) < DUPLICATE_TAKEN_WINDOW_MS;
  });
  if (recentDuplicate) return true;

  const takenAtIso = now.toISOString();
  const dose: SickDayMedicationDoseLogEntry = {
    id: crypto.randomUUID(),
    reminderId,
    name: entry.name,
    doseLabel: entry.doseLabel,
    takenAtIso,
    source: "user",
  };
  storage.addSickDayMedicationDoseEntry(dose);

  // Anchor to the due that fired; if the in-app poller already advanced
  // `nextDueAtIso` into the future, keep that value rather than skipping a cycle.
  const entryNextMs = new Date(entry.nextDueAtIso).getTime();
  const nextDueAtIso = firedDueAtIso
    ? computeNextDueAfterReminderFired(firedDueAtIso, entry.repeatEveryMinutes, nowMs)
    : Number.isFinite(entryNextMs) && entryNextMs > nowMs
      ? entry.nextDueAtIso
      : computeNextDueAfterReminderFired(entry.nextDueAtIso, entry.repeatEveryMinutes, nowMs);

  storage.updateSickDayMedicationEntry(reminderId, {
    takenAtIso,
    nextDueAtIso,
    lastInAppNotifiedDueAtIso: undefined,
  });

  const updated = storage.getSickDayMedicationLog().find((e) => e.id === reminderId);
  if (updated) {
    void scheduleSickDayMedReminder(updated);
    void createSickDayMedInAppNotification({
      title: "Medication logged",
      body: `${updated.name}${updated.doseLabel ? ` · ${updated.doseLabel}` : ""} · taken ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · next reminder ${new Date(nextDueAtIso).toLocaleTimeString(undefined, { timeStyle: "short" })}`,
      reminderId: updated.id,
      dueAtIso: nextDueAtIso,
      name: updated.name,
    });
  }

  notifySickDayMedsChanged();
  return true;
}
