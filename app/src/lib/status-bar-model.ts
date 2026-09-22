/**
 * Pure model for the app LIVE status bar: which segments to show,
 * when travel is promoted vs quiet, and expand-panel sections.
 */

import {
  daysNeededForTimezoneShift,
  daysPastTravelEnd,
  isTravelInsulinHomebound,
  timezoneChangeFromHours,
  type TravelTimezoneSlice,
} from "@/lib/travel-insulin-clock";

export type StatusBarSegmentKind =
  | "bg"
  | "travel"
  | "sick"
  | "exercise"
  | "post_exercise"
  | "pump"
  | "offline";

export type StatusBarSegment = {
  kind: StatusBarSegmentKind;
  /** Compact bar label; null = icon-only (quiet presence). */
  label: string | null;
  promoted: boolean;
  href?: string;
  testId: string;
};

export type StatusBarExpandSectionId =
  | "travel"
  | "sick"
  | "exercise"
  | "post_exercise"
  | "pump"
  | "offline"
  | "bg";

export type StatusBarExpandSection = {
  id: StatusBarExpandSectionId;
  title: string;
  subtitle?: string;
  href?: string;
  /** Primary end/clear action when present. */
  canEnd?: boolean;
};

export type TravelPromoteInput = {
  travelModeActive: boolean;
  travelStartDate?: string;
  travelEndDate?: string;
  timezoneHours: number;
  timezoneChange: TravelTimezoneSlice["timezoneChange"];
  packingIncomplete: boolean;
  today?: Date;
};

export type TravelPromoteResult = {
  promoted: boolean;
  /** Short label when promoted; null when quiet. */
  label: string | null;
  reason: "none" | "quiet" | "homebound" | "insulin_shift" | "packing" | "return_day";
};

function parseDateOnly(iso: string | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysPastTravelStart(today: Date, startDate: Date): number {
  const t = new Date(today);
  const s = new Date(startDate);
  t.setHours(0, 0, 0, 0);
  s.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

/** True on outbound travel days that still need the gradual insulin clock shift. */
export function isTravelInsulinOutboundShiftDay(
  today: Date,
  startDate: Date,
  endDate: Date,
  timezoneHours: number,
  timezoneChange: TravelTimezoneSlice["timezoneChange"] = timezoneChangeFromHours(timezoneHours),
): boolean {
  if (timezoneChange === "none" || timezoneHours <= 0) return false;
  if (isTravelInsulinHomebound(today, endDate, timezoneHours, timezoneChange)) return false;
  const pastStart = daysPastTravelStart(today, startDate);
  if (pastStart < 0) return false;
  const pastEnd = daysPastTravelEnd(today, endDate);
  if (pastEnd >= 0) return false;
  return pastStart <= daysNeededForTimezoneShift(timezoneHours);
}

/**
 * Travel stays icon-only on quiet holiday days; promote only when actionable today.
 */
export function resolveTravelPromote(input: TravelPromoteInput): TravelPromoteResult {
  if (!input.travelModeActive) {
    return { promoted: false, label: null, reason: "none" };
  }

  const today = input.today ?? new Date();
  const start = parseDateOnly(input.travelStartDate);
  const end = parseDateOnly(input.travelEndDate);
  const hours = input.timezoneHours;
  const change = input.timezoneChange;

  if (end && isTravelInsulinHomebound(today, end, hours, change)) {
    const past = daysPastTravelEnd(today, end);
    if (past === 0) {
      return { promoted: true, label: "Return", reason: "return_day" };
    }
    return { promoted: true, label: "Homebound", reason: "homebound" };
  }

  if (start && end && isTravelInsulinOutboundShiftDay(today, start, end, hours, change)) {
    return { promoted: true, label: "Insulin", reason: "insulin_shift" };
  }

  if (input.packingIncomplete) {
    return { promoted: true, label: "Pack", reason: "packing" };
  }

  return { promoted: false, label: null, reason: "quiet" };
}

export type BuildStatusBarModelInput = {
  showCgm: boolean;
  online: boolean;
  offlineQueuedCount?: number;
  travelModeActive: boolean;
  travelDestination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  timezoneHours: number;
  timezoneChange: TravelTimezoneSlice["timezoneChange"];
  packingIncomplete: boolean;
  sickDayActive: boolean;
  sickDaySeverity?: string;
  pumpFailureActive: boolean;
  exerciseActive: boolean;
  exercisePhaseLabel?: string;
  exerciseTimerLabel?: string | null;
  postExerciseEducational: boolean;
  postExerciseSnoozed: boolean;
  today?: Date;
};

export type StatusBarModel = {
  visible: boolean;
  travel: TravelPromoteResult;
  segments: StatusBarSegment[];
  expandSections: StatusBarExpandSection[];
};

export function buildStatusBarModel(input: BuildStatusBarModelInput): StatusBarModel {
  const travel = resolveTravelPromote({
    travelModeActive: input.travelModeActive,
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    timezoneHours: input.timezoneHours,
    timezoneChange: input.timezoneChange,
    packingIncomplete: input.packingIncomplete,
    today: input.today,
  });

  const segments: StatusBarSegment[] = [];
  const expandSections: StatusBarExpandSection[] = [];

  if (input.showCgm) {
    segments.push({
      kind: "bg",
      label: null,
      promoted: true,
      href: "/tools/cgm-live",
      testId: "status-segment-bg",
    });
    expandSections.push({
      id: "bg",
      title: "Live glucose",
      subtitle: "Open trends and CGM tools",
      href: "/tools/cgm-live",
    });
  }

  if (!input.online) {
    const queued = input.offlineQueuedCount ?? 0;
    segments.push({
      kind: "offline",
      label: "Offline",
      promoted: true,
      testId: "status-segment-offline",
    });
    expandSections.push({
      id: "offline",
      title: "You're offline",
      subtitle: queued > 0 ? `${queued} queued to sync` : "Changes will sync when you're back online",
    });
  }

  if (input.sickDayActive) {
    const sev = input.sickDaySeverity?.trim();
    segments.push({
      kind: "sick",
      label: sev ? `Sick · ${sev}` : "Sick",
      promoted: true,
      href: "/scenarios/sick-day#sickday-checklist",
      testId: "status-segment-sick",
    });
    expandSections.push({
      id: "sick",
      title: sev ? `Sick day · ${sev}` : "Sick day",
      subtitle: "Checklist and guidance",
      href: "/scenarios/sick-day#sickday-checklist",
      canEnd: true,
    });
  }

  if (input.travelModeActive) {
    const dest = input.travelDestination?.trim();
    segments.push({
      kind: "travel",
      label: travel.promoted ? travel.label : null,
      promoted: travel.promoted,
      href: "/scenarios/travel",
      testId: "status-segment-travel",
    });
    expandSections.push({
      id: "travel",
      title: dest ? `Travel · ${dest}` : "Travel",
      subtitle: travel.promoted
        ? travel.reason === "packing"
          ? "Packing list still open"
          : travel.reason === "homebound" || travel.reason === "return_day"
            ? "Shift long-acting back toward home time"
            : travel.reason === "insulin_shift"
              ? "Check Insulin times for today's local clock"
              : undefined
        : "Trip active — open for plan and packing",
      href: "/scenarios/travel",
      canEnd: true,
    });
  }

  if (input.exerciseActive) {
    const phase = input.exercisePhaseLabel ?? "active";
    const timer = input.exerciseTimerLabel?.trim();
    const label = timer ? `${phase} · ${timer}` : phase;
    segments.push({
      kind: "exercise",
      label,
      promoted: true,
      href: "/scenarios/exercise",
      testId: "status-segment-exercise",
    });
    expandSections.push({
      id: "exercise",
      title: `Exercise · ${phase}`,
      subtitle: timer ? `Timer ${timer}` : "Open guide and controls",
      href: "/scenarios/exercise",
      canEnd: true,
    });
  } else if (input.postExerciseEducational) {
    segments.push({
      kind: "post_exercise",
      label: "Post-ex",
      promoted: true,
      testId: "status-segment-post-exercise",
    });
    expandSections.push({
      id: "post_exercise",
      title: "Post-exercise · 24h",
      subtitle: "Tips for the hours after your workout",
    });
  } else if (input.postExerciseSnoozed) {
    segments.push({
      kind: "post_exercise",
      label: "Post-ex",
      promoted: false,
      testId: "status-segment-post-exercise",
    });
    expandSections.push({
      id: "post_exercise",
      title: "Post-exercise · reminders off",
      subtitle: "Resume tips when you want them again",
    });
  }

  if (input.pumpFailureActive) {
    segments.push({
      kind: "pump",
      label: "Pump",
      promoted: true,
      href: "/scenarios/pump-failure",
      testId: "status-segment-pump",
    });
    expandSections.push({
      id: "pump",
      title: "Pump failure",
      subtitle: "Backup plan and checks",
      href: "/scenarios/pump-failure",
      canEnd: true,
    });
  }

  const visible =
    input.showCgm ||
    !input.online ||
    input.sickDayActive ||
    input.travelModeActive ||
    input.exerciseActive ||
    input.postExerciseEducational ||
    input.postExerciseSnoozed ||
    input.pumpFailureActive;

  return { visible, travel, segments, expandSections };
}

/** Packing list incomplete when there is at least one unchecked item. */
export function isTravelPackingIncomplete(packingList: { checked?: boolean }[] | null | undefined): boolean {
  if (!packingList?.length) return false;
  return packingList.some((item) => !item.checked);
}
