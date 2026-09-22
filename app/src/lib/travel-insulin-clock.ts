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

export type TravelInsulinLeg = "outbound" | "return";

const MAX_SHIFT_HOURS_PER_DAY = 2;

/** Days of gradual shift needed for a given hour delta (ceil hours / 2). */
export function daysNeededForTimezoneShift(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.ceil(hours / MAX_SHIFT_HOURS_PER_DAY);
}

export function flipTimezoneDirection(
  direction: "east" | "west" | "none",
): "east" | "west" | "none" {
  if (direction === "east") return "west";
  if (direction === "west") return "east";
  return "none";
}

function formatClockMinutes(totalMinutes: number): string {
  let mins = totalMinutes % (24 * 60);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parseAnchorMinutes(basalInjectionTime: string): number | null {
  const anchor = basalInjectionTime.trim();
  if (!anchor) return null;
  const [hours, minutes] = anchor.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** Gradual MDI long-acting clock shift for a single home-clock anchor time (outbound). */
export function buildBasalAdjustmentSchedule(
  basalInjectionTime: string,
  plan: TravelTimezoneSlice,
): BasalAdjustmentRow[] {
  const homeTimeMinutes = parseAnchorMinutes(basalInjectionTime);
  if (plan.timezoneChange === "none" || homeTimeMinutes == null || plan.timezoneHours <= 0) return [];

  const anchor = basalInjectionTime.trim();
  const tzDiff = plan.timezoneHours;
  const direction = plan.timezoneDirection;
  const daysToAdjust = daysNeededForTimezoneShift(tzDiff);
  const schedule: BasalAdjustmentRow[] = [];

  schedule.push({
    day: 0,
    label: "Travel day",
    homeTime: anchor,
    localTime: formatClockMinutes(homeTimeMinutes + (direction === "east" ? tzDiff * 60 : -tzDiff * 60)),
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
      homeTime: formatClockMinutes(adjustedHomeMinutes),
      localTime: formatClockMinutes(adjustedLocalMinutes),
      note: isFullyAdjusted ? "On local time from here." : `Moved ${shiftSoFar}h of ${tzDiff}h.`,
    });
  }

  if (daysToAdjust > 0) {
    schedule.push({
      day: daysToAdjust + 1,
      label: "After that",
      homeTime:
        direction === "east"
          ? formatClockMinutes(homeTimeMinutes - tzDiff * 60)
          : formatClockMinutes(homeTimeMinutes + tzDiff * 60),
      localTime: anchor,
      note: "Keep taking at this local time until your return travel day — Insulin times will reverse for you.",
    });
  }

  return schedule;
}

/**
 * Homebound reverse of outbound: flip direction, same hour delta, re-anchored on the
 * destination-adapted local clock (original home HH:MM while away).
 */
export function buildBasalReturnAdjustmentSchedule(
  basalInjectionTime: string,
  plan: TravelTimezoneSlice,
): BasalAdjustmentRow[] {
  const flipped: TravelTimezoneSlice = {
    ...plan,
    timezoneDirection: flipTimezoneDirection(plan.timezoneDirection),
  };
  const rows = buildBasalAdjustmentSchedule(basalInjectionTime, flipped);
  return rows.map((row) => {
    if (row.day === 0) {
      return {
        ...row,
        label: "Return travel day",
        note: "Keep destination timing — shown here in home local time too.",
      };
    }
    if (row.label === "After that") {
      return {
        ...row,
        label: "Back on home time",
        note: "You're back on your usual home injection time.",
      };
    }
    const fullyHome = row.note.startsWith("On local time");
    return {
      ...row,
      label: `Day ${row.day} home`,
      note: fullyHome ? "On home time from here." : row.note,
    };
  });
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

/** Calendar days past endDate (0 on return day). Negative before return. */
export function daysPastTravelEnd(today: Date, endDate: Date): number {
  const t = new Date(today);
  const e = new Date(endDate);
  t.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - e.getTime()) / (1000 * 60 * 60 * 24));
}

/** True from return travel day through the last homebound shift day (inclusive). */
export function isTravelInsulinHomebound(
  today: Date,
  endDate: Date,
  timezoneHours: number,
  timezoneChange: "none" | "minor" | "major" = timezoneChangeFromHours(timezoneHours),
): boolean {
  if (timezoneChange === "none" || timezoneHours <= 0) return false;
  const past = daysPastTravelEnd(today, endDate);
  const shiftDays = daysNeededForTimezoneShift(timezoneHours);
  return past >= 0 && past <= shiftDays;
}

/**
 * Auto-end travel mode after the homebound insulin window.
 * With no TZ shift, ends the day after endDate (same as before).
 */
export function shouldAutoEndTravelMode(
  today: Date,
  endDate: Date,
  timezoneHours: number,
): boolean {
  const past = daysPastTravelEnd(today, endDate);
  const shiftDays = daysNeededForTimezoneShift(timezoneHours);
  return past > shiftDays;
}
