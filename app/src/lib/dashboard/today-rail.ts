import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import type { Appointment, ScenarioState, Supply } from "@/lib/storage";
import type { SickDayMedicationLogEntry } from "@/lib/storage";
import type { ActiveExerciseSession } from "@/lib/storage";

export type TodayRailItem = {
  id: string;
  priority: number;
  title: string;
  detail?: string;
  primary: { label: string; href: string };
  ask?: { topic: CoachTopicSlug; label: string };
};

export type TodayRailInput = {
  now: Date;
  supplies: Supply[];
  getSupplyStatus: (s: Supply) => "critical" | "low" | "ok";
  scenarioState: ScenarioState;
  activeExercise: ActiveExerciseSession | null;
  sickDayMeds: SickDayMedicationLogEntry[];
  appointments: Appointment[];
  unreadInAppCount: number;
};

function nextDueMed(meds: SickDayMedicationLogEntry[], now: Date): SickDayMedicationLogEntry | null {
  const active = meds.filter((e) => !e.dismissedAtIso);
  let best: SickDayMedicationLogEntry | null = null;
  let bestDue = Infinity;
  for (const e of active) {
    const t = new Date(e.nextDueAtIso).getTime();
    if (Number.isNaN(t)) continue;
    if (t <= bestDue) {
      bestDue = t;
      best = e;
    }
  }
  if (!best) return null;
  const dueAt = new Date(best.nextDueAtIso).getTime();
  const graceMs = 2 * 60 * 60 * 1000;
  if (dueAt <= now.getTime() + graceMs) return best;
  return null;
}

function nextAppointmentSoon(appointments: Appointment[], now: Date, withinMs: number): Appointment | null {
  const t0 = now.getTime();
  const t1 = t0 + withinMs;
  let best: Appointment | null = null;
  let bestT = Infinity;
  for (const a of appointments) {
    if (a.isCompleted || a.deletedAt) continue;
    const day = a.date?.trim();
    if (!day) continue;
    const time = a.time?.trim();
    const isoGuess = time ? `${day}T${time}:00` : `${day}T12:00:00`;
    const at = new Date(isoGuess).getTime();
    if (Number.isNaN(at)) continue;
    if (at >= t0 && at <= t1 && at < bestT) {
      bestT = at;
      best = a;
    }
  }
  return best;
}

function hasCritical(supplies: Supply[], getSupplyStatus: (s: Supply) => string): boolean {
  return supplies.some((s) => getSupplyStatus(s) === "critical");
}

function hasLowOnly(supplies: Supply[], getSupplyStatus: (s: Supply) => string): boolean {
  return supplies.some((s) => getSupplyStatus(s) === "low") && !hasCritical(supplies, getSupplyStatus);
}

export function buildTodayRailItems(input: TodayRailInput): TodayRailItem[] {
  const { now, supplies, scenarioState, activeExercise, sickDayMeds, appointments, unreadInAppCount } = input;
  const { getSupplyStatus } = input;
  const items: TodayRailItem[] = [];

  const medDue = nextDueMed(sickDayMeds, now);
  let showedSickDayRow = false;
  if (scenarioState.sickDayActive && medDue) {
    const dueLabel = new Date(medDue.nextDueAtIso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    items.push({
      id: "sickday-med",
      priority: 1,
      title: "Medication due",
      detail: `${medDue.name} · due ${dueLabel}`,
      primary: { label: "Open sick day", href: "/sick-day#sickday-checklist" },
      ask: { topic: "sick-day", label: "Ask the coach" },
    });
    showedSickDayRow = true;
  } else if (scenarioState.sickDayActive) {
    items.push({
      id: "scenario-sick",
      priority: 2,
      title: "Sick day mode",
      detail: scenarioState.sickDaySeverity ? `Severity: ${scenarioState.sickDaySeverity}` : undefined,
      primary: { label: "Resume", href: "/sick-day" },
      ask: { topic: "sick-day", label: "Ask the coach" },
    });
    showedSickDayRow = true;
  }

  if (!showedSickDayRow) {
    if (scenarioState.pumpFailureActive) {
      items.push({
        id: "scenario-pump",
        priority: 2,
        title: "Pump or infusion backup",
        primary: { label: "Resume", href: "/scenarios/pump-failure" },
        ask: { topic: "pump-failure", label: "Ask the coach" },
      });
    } else if (scenarioState.alcoholModeActive) {
      items.push({
        id: "scenario-alcohol",
        priority: 2,
        title: "Alcohol mode",
        primary: { label: "Resume", href: "/scenarios/alcohol" },
        ask: { topic: "alcohol", label: "Ask the coach" },
      });
    } else if (scenarioState.travelModeActive) {
      items.push({
        id: "scenario-travel",
        priority: 2,
        title: "Travel mode",
        detail: scenarioState.travelDestination,
        primary: { label: "Resume", href: "/travel" },
        ask: { topic: "travel", label: "Ask the coach" },
      });
    } else if (activeExercise) {
      items.push({
        id: "scenario-exercise",
        priority: 2,
        title: "Exercise in progress",
        primary: { label: "Resume", href: "/scenarios/exercise" },
        ask: { topic: "exercise", label: "Ask the coach" },
      });
    }
  }

  if (hasCritical(supplies, getSupplyStatus)) {
    items.push({
      id: "supply-critical",
      priority: 3,
      title: "Supply running low",
      detail: "At least one item is in a critical window",
      primary: { label: "Open supplies", href: "/supplies" },
      ask: { topic: "general", label: "Ask the coach" },
    });
  }

  const soon = nextAppointmentSoon(appointments, now, 72 * 60 * 60 * 1000);
  if (soon) {
    items.push({
      id: `appt-${soon.id}`,
      priority: 4,
      title: "Upcoming appointment",
      detail: soon.title,
      primary: { label: "View", href: "/appointments" },
      ask: { topic: "clinic", label: "Ask the coach" },
    });
  }

  if (unreadInAppCount > 0) {
    items.push({
      id: "inapp-unread",
      priority: 5,
      title: "Notifications",
      detail: `${unreadInAppCount} unread`,
      primary: { label: "Open inbox", href: "/notifications" },
    });
  }

  if (hasLowOnly(supplies, getSupplyStatus)) {
    items.push({
      id: "supply-low",
      priority: 6,
      title: "Supplies worth checking",
      primary: { label: "Open supplies", href: "/supplies" },
      ask: { topic: "general", label: "Ask the coach" },
    });
  }

  items.sort((a, b) => a.priority - b.priority);
  return items;
}
