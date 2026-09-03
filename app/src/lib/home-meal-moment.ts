export type HomeMealSlot = "breakfast" | "lunch" | "dinner";

export type HomeMealMoment = {
  slot: HomeMealSlot;
  title: string;
  timeLabel: string;
};

const MEAL_WINDOWS: Array<{
  slot: HomeMealSlot;
  startMinute: number;
  endMinute: number;
  title: string;
  timeLabel: string;
}> = [
  { slot: "breakfast", startMinute: 6 * 60, endMinute: 10 * 60 + 30, title: "Planning breakfast?", timeLabel: "Morning" },
  { slot: "lunch", startMinute: 11 * 60, endMinute: 15 * 60, title: "Planning lunch?", timeLabel: "Midday" },
  { slot: "dinner", startMinute: 17 * 60, endMinute: 21 * 60 + 30, title: "Planning dinner?", timeLabel: "Evening" },
];

/** Returns a deterministic, local-time meal prompt. Personal meal times can replace these defaults later. */
export function getHomeMealMoment(now: Date): HomeMealMoment | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  const window = MEAL_WINDOWS.find(({ startMinute, endMinute }) => minute >= startMinute && minute < endMinute);
  if (!window) return null;
  return {
    slot: window.slot,
    title: window.title,
    timeLabel: window.timeLabel,
  };
}

export function homeMealDismissalKey(now: Date, slot: HomeMealSlot): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}:${slot}`;
}
