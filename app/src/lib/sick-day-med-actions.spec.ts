import { beforeEach, describe, expect, it, vi } from "vitest";

import { markSickDayMedicationTakenFromNotification } from "./sick-day-med-actions";
import { storage, type SickDayMedicationLogEntry } from "@/lib/storage";

vi.mock("@/lib/sick-day-med-reminders", () => ({
  scheduleSickDayMedReminder: vi.fn(async () => ({ scheduled: false })),
}));

vi.mock("@/lib/sick-day-med-inapp", () => ({
  createSickDayMedInAppNotification: vi.fn(async () => ({ ok: true })),
}));

const NOW = new Date("2026-07-17T10:05:00.000Z");

function seedEntry(overrides: Partial<SickDayMedicationLogEntry> = {}): SickDayMedicationLogEntry {
  const entry: SickDayMedicationLogEntry = {
    id: "rem-1",
    name: "Paracetamol",
    doseLabel: "500mg",
    takenAtIso: "2026-07-17T04:00:00.000Z",
    repeatEveryMinutes: 360,
    nextDueAtIso: "2026-07-17T10:00:00.000Z",
    createdAtIso: "2026-07-17T04:00:00.000Z",
    ...overrides,
  };
  storage.addSickDayMedicationEntry(entry);
  return entry;
}

beforeEach(() => {
  localStorage.clear();
});

describe("markSickDayMedicationTakenFromNotification", () => {
  it("returns false for an unknown reminder", async () => {
    expect(await markSickDayMedicationTakenFromNotification("nope", null, NOW)).toBe(false);
    expect(storage.getSickDayMedicationDoseLog()).toHaveLength(0);
  });

  it("returns false for a dismissed reminder", async () => {
    seedEntry({ dismissedAtIso: "2026-07-17T09:00:00.000Z" });
    expect(await markSickDayMedicationTakenFromNotification("rem-1", null, NOW)).toBe(false);
  });

  it("logs a dose and advances the next due from the fired due time", async () => {
    seedEntry();
    const ok = await markSickDayMedicationTakenFromNotification(
      "rem-1",
      "2026-07-17T10:00:00.000Z",
      NOW,
    );
    expect(ok).toBe(true);

    const doses = storage.getSickDayMedicationDoseLog();
    expect(doses).toHaveLength(1);
    expect(doses[0]).toMatchObject({
      reminderId: "rem-1",
      name: "Paracetamol",
      doseLabel: "500mg",
      source: "user",
      takenAtIso: NOW.toISOString(),
    });

    const entry = storage.getSickDayMedicationLog().find((e) => e.id === "rem-1")!;
    expect(entry.takenAtIso).toBe(NOW.toISOString());
    // Fired at 10:00, repeat 6h → next due 16:00 (anchored to due, not tap).
    expect(entry.nextDueAtIso).toBe("2026-07-17T16:00:00.000Z");
    expect(entry.lastInAppNotifiedDueAtIso).toBeUndefined();
  });

  it("keeps an already-advanced next due instead of skipping a cycle", async () => {
    // The in-app poller already moved nextDueAtIso into the future.
    seedEntry({ nextDueAtIso: "2026-07-17T16:00:00.000Z" });
    await markSickDayMedicationTakenFromNotification("rem-1", null, NOW);

    const entry = storage.getSickDayMedicationLog().find((e) => e.id === "rem-1")!;
    expect(entry.nextDueAtIso).toBe("2026-07-17T16:00:00.000Z");
  });

  it("ignores a duplicate tap within ten minutes", async () => {
    seedEntry();
    await markSickDayMedicationTakenFromNotification("rem-1", "2026-07-17T10:00:00.000Z", NOW);
    const again = await markSickDayMedicationTakenFromNotification(
      "rem-1",
      "2026-07-17T10:00:00.000Z",
      new Date(NOW.getTime() + 60_000),
    );
    expect(again).toBe(true);
    expect(storage.getSickDayMedicationDoseLog()).toHaveLength(1);
  });

  it("dispatches the meds-changed event so open pages refresh", async () => {
    seedEntry();
    const listener = vi.fn();
    window.addEventListener("diabeater:sick-day-meds-changed", listener);
    await markSickDayMedicationTakenFromNotification("rem-1", null, NOW);
    window.removeEventListener("diabeater:sick-day-meds-changed", listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
