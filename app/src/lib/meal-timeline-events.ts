export type MealTimelineEventStatus = "planned" | "confirmed";

export type MealTimelineEvent = {
  id: string;
  occurredAt: string;
  mealType: string;
  carbsGrams: number;
  compositionLabel: string;
  status: MealTimelineEventStatus;
};

type MealTimelineEventInput = Omit<MealTimelineEvent, "id" | "occurredAt" | "status">;

const STORAGE_KEY = "diabeater_meal_timeline_events";
export const MEAL_TIMELINE_CHANGED_EVENT = "diabeater:meal-timeline-changed";
const MAX_EVENTS = 100;

function readEvents(): MealTimelineEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (event): event is MealTimelineEvent =>
        event != null &&
        typeof event.id === "string" &&
        typeof event.occurredAt === "string" &&
        typeof event.mealType === "string" &&
        Number.isFinite(event.carbsGrams) &&
        (event.status === "planned" || event.status === "confirmed"),
    );
  } catch {
    return [];
  }
}

function writeEvents(events: MealTimelineEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  window.dispatchEvent(new CustomEvent(MEAL_TIMELINE_CHANGED_EVENT));
}

function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function savePlannedMealEvent(
  input: MealTimelineEventInput,
  existingId?: string | null,
): MealTimelineEvent {
  const events = readEvents();
  const existing = existingId ? events.find((event) => event.id === existingId) : null;
  const next: MealTimelineEvent = {
    id: existing?.id ?? eventId(),
    occurredAt: existing?.occurredAt ?? new Date().toISOString(),
    status: existing?.status ?? "planned",
    ...input,
  };
  const withoutExisting = events.filter((event) => event.id !== next.id);
  writeEvents([next, ...withoutExisting]);
  return next;
}

export function confirmMealTimelineEvent(id: string): MealTimelineEvent | null {
  const events = readEvents();
  const index = events.findIndex((event) => event.id === id);
  if (index < 0) return null;
  const confirmed = { ...events[index], status: "confirmed" as const };
  events[index] = confirmed;
  writeEvents(events);
  return confirmed;
}

export function getMealTimelineEvents(startMs: number, endMs = Date.now()): MealTimelineEvent[] {
  return readEvents()
    .filter((event) => {
      const time = new Date(event.occurredAt).getTime();
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    })
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}
