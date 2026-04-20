import type { ActivityLog, ExerciseIntensity, ExerciseOutcome, ExerciseType, HypoTreatment } from "@/lib/storage";

export type ExercisePersonalizationLine = {
  id: string;
  text: string;
};

function withinLastDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function hoursBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / (60 * 60 * 1000);
}

function parseExercisePlanningLog(details: string): {
  type?: string;
  duration?: number;
  intensity?: string;
} | null {
  // Example: "moderate cardio for 45 minutes | {...}"
  const pipe = details.indexOf("|");
  const head = (pipe >= 0 ? details.slice(0, pipe) : details).trim();
  const m = head.match(/^(\w+)\s+(\w+)\s+for\s+(\d+)\s+minutes$/i);
  if (!m) return null;
  const intensity = m[1]?.toLowerCase();
  const exerciseType = m[2]?.toLowerCase();
  const duration = parseInt(m[3] ?? "", 10);
  if (!intensity || !exerciseType || !Number.isFinite(duration)) return null;
  return { intensity, exerciseType, duration };
}

function matchesSessionShape(
  o: ExerciseOutcome,
  type: string,
  intensity: ExerciseIntensity,
  durationMinutes: number,
): boolean {
  if (o.exerciseType !== (type as ExerciseType)) return false;
  if (o.intensity !== intensity) return false;
  // Loose match: similar duration bucket (±15m) so rounding still yields signal.
  return Math.abs(o.durationMinutes - durationMinutes) <= 15;
}

/**
 * Small, explainable "history" lines for the exercise planner.
 * Conservative: mostly nudges + prioritization hints, not dose changes.
 */
export function buildExercisePersonalizationLines(input: {
  exerciseType: string;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  outcomes: ExerciseOutcome[];
  hypoTreatments: HypoTreatment[];
  activityLogs: ActivityLog[];
}): ExercisePersonalizationLine[] {
  const lines: ExercisePersonalizationLine[] = [];

  const recentOutcomes = input.outcomes.filter((o) => withinLastDays(o.completedAt, 90));
  const similar = recentOutcomes.filter((o) =>
    matchesSessionShape(o, input.exerciseType, input.intensity, input.durationMinutes),
  );

  if (similar.length >= 3) {
    const dropped = similar.filter((o) => o.bgResponse === "dropped").length;
    const rose = similar.filter((o) => o.bgResponse === "rose").length;
    const stable = similar.filter((o) => o.bgResponse === "stable").length;
    const hypo = similar.filter((o) => o.feltHypo).length;

    if (dropped >= 2) {
      lines.push({
        id: "pattern_drop",
        text: `In your last similar sessions, glucose often dropped (${dropped}/${similar.length} logged). Plan extra checks and recovery fuel.`,
      });
    } else if (rose >= 2) {
      lines.push({
        id: "pattern_rise",
        text: `In your last similar sessions, glucose often rose (${rose}/${similar.length} logged). Watch for a later dip after effort.`,
      });
    } else if (stable >= 2) {
      lines.push({
        id: "pattern_stable",
        text: `In your last similar sessions, glucose often stayed stable (${stable}/${similar.length} logged). Still monitor—days vary.`,
      });
    }

    if (hypo >= 1) {
      lines.push({
        id: "pattern_hypo",
        text: `You’ve logged feeling hypo after similar sessions before (${hypo}/${similar.length}). Keep treatment within reach during and after.`,
      });
    }
  }

  // Hypo proximity heuristic: hypos logged within a few hours after an exercise outcome timestamp.
  const recentHypos = input.hypoTreatments.filter((h) => withinLastDays(h.timestamp, 90));
  if (recentOutcomes.length > 0 && recentHypos.length > 0) {
    let near = 0;
    for (const o of recentOutcomes) {
      for (const h of recentHypos) {
        const dt = hoursBetween(o.completedAt, h.timestamp);
        if (dt <= 6) {
          near++;
          break;
        }
      }
    }
    if (near >= 2) {
      lines.push({
        id: "hypo_near_exercise",
        text: "Your hypo logs sometimes cluster near workouts. Pay extra attention in the hours after you finish.",
      });
    }
  }

  // Prefill hint from last planner activity log (same shape as ExercisePlanner logging).
  const planning = input.activityLogs
    .filter((l) => l.activityType === "exercise_planning")
    .slice(0, 25)
    .map((l) => parseExercisePlanningLog(l.activityDetails))
    .filter(Boolean) as Array<{ type?: string; duration?: number; intensity?: string }>;

  const last = planning[0];
  if (last?.type && last.duration && last.intensity) {
    const sameShape =
      last.type === input.exerciseType &&
      last.intensity === input.intensity &&
      last.duration === input.durationMinutes;
    if (!sameShape) {
      lines.push({
        id: "last_planned_different",
        text: `Last planned workout: ${last.intensity} ${last.type} · ${last.duration} min (tap Edit to reuse your usual inputs).`,
      });
    }
  }

  // Keep the UI scannable.
  return lines.slice(0, 2);
}
