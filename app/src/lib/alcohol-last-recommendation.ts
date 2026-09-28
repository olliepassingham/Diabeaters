import type { AlcoholIntensity } from "@/lib/alcohol-night-tool";
import type { AlcoholSituationInput, AlcoholSituationKind, AlcoholSituationOutcome } from "@/lib/alcohol-situation-tool";

const STORAGE_KEY = "diabeater_alcohol_last_recommendation";

const SITUATION_LABEL: Record<AlcoholSituationKind, string> = {
  meal_with_drinks: "Meal with drinks",
  late_snack: "Late snack",
  before_out: "Before going out",
  feels_wrong: "Felt unwell",
};

const INTENSITY_LABEL: Record<AlcoholIntensity, string> = {
  light: "Light",
  moderate: "Moderate",
  long_or_heavy: "Heavier night",
};

export type AlcoholLastRecommendation = {
  askedAtIso: string;
  summary: string;
};

export function alcoholRecommendationSummary(
  input: AlcoholSituationInput,
  outcome: AlcoholSituationOutcome,
): string | null {
  if (outcome.kind === "needs_ratios" || outcome.kind === "needs_carbs") return null;
  if (outcome.kind === "estimate") return outcome.alcoholGuidance.contextLabel;
  const situation = SITUATION_LABEL[input.situation];
  const intensity = INTENSITY_LABEL[input.drinkingIntensity];
  if (outcome.kind === "urgent" || outcome.kind === "hypo_first") {
    return `${situation} · ${outcome.headline}`;
  }
  return `${situation} · ${intensity}`;
}

export function saveAlcoholLastRecommendation(snapshot: AlcoholLastRecommendation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function readAlcoholLastRecommendation(): AlcoholLastRecommendation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AlcoholLastRecommendation>;
    if (!parsed || typeof parsed.askedAtIso !== "string" || typeof parsed.summary !== "string") return null;
    if (!parsed.summary.trim() || Number.isNaN(new Date(parsed.askedAtIso).getTime())) return null;
    return { askedAtIso: parsed.askedAtIso, summary: parsed.summary.trim() };
  } catch {
    return null;
  }
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatAlcoholRecommendationWhen(
  askedAtIso: string,
  now = new Date(),
): { title: string; when: string } {
  const at = new Date(askedAtIso);
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameCalendarDay(at, now)) return { title: "Today", when: time };
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameCalendarDay(at, yesterday)) return { title: "Last night", when: time };
  const date = at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return { title: "Last time", when: `${date} · ${time}` };
}
