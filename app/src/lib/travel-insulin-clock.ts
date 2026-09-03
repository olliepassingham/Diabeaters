/** Educational MDI long-acting clock shift across a time-zone change. Times only — not doses. */

export type TravelTimezoneSlice = {
  timezoneHours: number;
  timezoneDirection: "east" | "west" | "none";
  timezoneChange: "none" | "minor" | "major";
};

export type BasalAdjustmentRow = {
  day: number;
  label: string;
  homeTime: string;
  localTime: string;
  note: string;
};

const MAX_SHIFT_HOURS_PER_DAY = 2;

/** Gradual MDI long-acting clock shift for a single home-clock anchor time. */
export function buildBasalAdjustmentSchedule(
  basalInjectionTime: string,
  plan: TravelTimezoneSlice,
): BasalAdjustmentRow[] {
  const anchor = basalInjectionTime.trim();
  if (plan.timezoneChange === "none" || !anchor || plan.timezoneHours <= 0) return [];

  const [hours, minutes] = anchor.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return [];

  const homeTimeMinutes = hours * 60 + minutes;
  const tzDiff = plan.timezoneHours;
  const direction = plan.timezoneDirection;

  const daysToAdjust = Math.ceil(tzDiff / MAX_SHIFT_HOURS_PER_DAY);
  const schedule: BasalAdjustmentRow[] = [];

  const formatTime = (totalMinutes: number) => {
    let mins = totalMinutes % (24 * 60);
    if (mins < 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  schedule.push({
    day: 0,
    label: "Travel day",
    homeTime: anchor,
    localTime: formatTime(homeTimeMinutes + (direction === "east" ? tzDiff * 60 : -tzDiff * 60)),
    note: "Take at your usual home time — shown here in local time too.",
  });

  for (let i = 1; i <= daysToAdjust; i++) {
    const shiftSoFar = Math.min(i * MAX_SHIFT_HOURS_PER_DAY, tzDiff);
    const shiftMinutes = shiftSoFar * 60;

    let adjustedHomeMinutes: number;
    let adjustedLocalMinutes: number;

    if (direction === "east") {
      adjustedHomeMinutes = homeTimeMinutes - shiftMinutes;
      adjustedLocalMinutes = homeTimeMinutes + tzDiff * 60 - shiftMinutes;
    } else {
      adjustedHomeMinutes = homeTimeMinutes + shiftMinutes;
      adjustedLocalMinutes = homeTimeMinutes - tzDiff * 60 + shiftMinutes;
    }

    const isFullyAdjusted = shiftSoFar >= tzDiff;

    schedule.push({
      day: i,
      label: `Day ${i}`,
      homeTime: formatTime(adjustedHomeMinutes),
      localTime: formatTime(adjustedLocalMinutes),
      note: isFullyAdjusted ? "On local time from here." : `Moved ${shiftSoFar}h of ${tzDiff}h.`,
    });
  }

  if (daysToAdjust > 0) {
    schedule.push({
      day: daysToAdjust + 1,
      label: "After that",
      homeTime:
        direction === "east"
          ? formatTime(homeTimeMinutes - tzDiff * 60)
          : formatTime(homeTimeMinutes + tzDiff * 60),
      localTime: anchor,
      note: "Keep taking at this local time until you fly home — then reverse the same steps.",
    });
  }

  return schedule;
}

export function pickBasalRowForDay(rows: BasalAdjustmentRow[], dayInTrip: number): BasalAdjustmentRow | null {
  if (!rows.length) return null;
  const entry = rows.find((s) => s.day === dayInTrip);
  if (entry) return entry;
  const lastEntry = rows[rows.length - 1];
  if (dayInTrip >= (lastEntry?.day ?? 0)) return lastEntry;
  return null;
}

export function timezoneChangeFromHours(hours: number): "none" | "minor" | "major" {
  if (hours <= 0) return "none";
  if (hours <= 3) return "minor";
  return "major";
}
