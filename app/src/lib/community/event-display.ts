import { format, formatDistanceStrict, startOfDay } from "date-fns";

export type EventTiming = "past" | "today" | "tomorrow" | "soon" | "upcoming";

export function parseEventDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatEventWhen(iso: string): string {
  const d = parseEventDate(iso);
  if (!d) return iso;
  return format(d, "EEE, d MMM yyyy · h:mm a");
}

export function getEventTiming(iso: string, now: Date = new Date()): EventTiming {
  const d = parseEventDate(iso);
  if (!d) return "upcoming";
  if (d.getTime() < now.getTime()) return "past";
  const days = Math.ceil((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "soon";
  return "upcoming";
}

export function eventTimingLabel(timing: EventTiming, iso: string, now: Date = new Date()): string {
  const d = parseEventDate(iso);
  if (!d) return "Event";
  switch (timing) {
    case "past":
      return "Past event";
    case "today":
      return `Today · ${format(d, "h:mm a")}`;
    case "tomorrow":
      return `Tomorrow · ${format(d, "h:mm a")}`;
    case "soon":
      return formatDistanceStrict(d, now, { addSuffix: true });
    default:
      return format(d, "d MMM");
  }
}

export function formatForDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Sensible default: tomorrow at 10:00 local. */
export function defaultEventStartsAtLocal(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return formatForDatetimeLocal(d);
}

export function eventQuickStartPresets(now: Date = new Date()): { id: string; label: string; value: string }[] {
  const tonight = new Date(now);
  tonight.setHours(19, 0, 0, 0);
  if (tonight.getTime() <= now.getTime()) {
    tonight.setDate(tonight.getDate() + 1);
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const saturday = new Date(now);
  const daysUntilSat = (6 - saturday.getDay() + 7) % 7 || 7;
  saturday.setDate(saturday.getDate() + daysUntilSat);
  saturday.setHours(10, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  return [
    { id: "tonight", label: "Tonight", value: formatForDatetimeLocal(tonight) },
    { id: "tomorrow", label: "Tomorrow", value: formatForDatetimeLocal(tomorrow) },
    { id: "saturday", label: "This Sat", value: formatForDatetimeLocal(saturday) },
    { id: "next-week", label: "Next week", value: formatForDatetimeLocal(nextWeek) },
  ];
}

export function buildMapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}
