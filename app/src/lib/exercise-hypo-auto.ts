import type { ActiveExerciseSession, UserProfile, UserSettings } from "@/lib/storage";
import { suggestedRecoveryTargetBg } from "@/lib/hypo-context";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";

/** BG value to use for hypo check: draft input wins when valid, else last logged for phase. */
export function resolveExerciseBgForHypo(session: ActiveExerciseSession, bgInputDraft?: string): number | null {
  const raw = bgInputDraft?.trim() ?? "";
  if (raw !== "") {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  if (session.phase === "pre") return session.preBg ?? null;
  if (session.phase === "active") return session.midBg ?? session.preBg ?? null;
  return session.recoveryBg ?? session.midBg ?? session.preBg ?? null;
}

/** Lower bound of “in range” from settings, else sensible default (3.9 mmol/L · 70 mg/dL). */
export function hypoRangeThreshold(settings: UserSettings | undefined, bgUnits: "mmol/L" | "mg/dL"): number {
  const low = settings?.targetBgLow;
  if (typeof low === "number" && low > 0) return low;
  return bgUnits === "mg/dL" ? 70 : 3.9;
}

export function isBgBelowHypoThreshold(
  bg: number,
  settings: UserSettings | undefined,
  bgUnits: "mmol/L" | "mg/dL",
): boolean {
  return bg < hypoRangeThreshold(settings, bgUnits);
}

export type ExerciseHypoSuggestion = {
  carbsGrams: number;
  glucoseTablets: number;
  juiceMl: number;
  /** When true, use team-specific plan — estimate is a typical first step only. */
  approximate: boolean;
};

function toMmol(bg: number, bgUnits: "mmol/L" | "mg/dL"): number {
  return bgUnits === "mg/dL" ? bg / 18 : bg;
}

/**
 * Same carbohydrate estimate as Hypo help for adults with known age;
 * for minors / unknown DOB uses a conservative ~15g first-step hint.
 */
export function computeExerciseHypoSuggestion(
  bg: number,
  settings: UserSettings | undefined,
  bgUnits: "mmol/L" | "mg/dL",
  profile: Partial<UserProfile>,
): ExerciseHypoSuggestion | null {
  if (!isBgBelowHypoThreshold(bg, settings, bgUnits)) return null;

  if (hypoCalculatorRequiresExplicitWeight(profile.dateOfBirth)) {
    return {
      carbsGrams: 15,
      glucoseTablets: 4,
      juiceMl: 150,
      approximate: true,
    };
  }

  const targetFromSettings = suggestedRecoveryTargetBg(settings, bgUnits);
  const threshold = hypoRangeThreshold(settings, bgUnits);
  const thresholdMmol = toMmol(threshold, bgUnits);
  const currentMmol = toMmol(bg, bgUnits);
  const targetMmol =
    targetFromSettings != null
      ? toMmol(targetFromSettings, bgUnits)
      : Math.max(5.5, thresholdMmol + 1.2);

  const bgDifference = targetMmol - currentMmol;
  if (bgDifference <= 0) {
    return {
      carbsGrams: 12,
      glucoseTablets: 3,
      juiceMl: 120,
      approximate: false,
    };
  }

  const weightKg = 70;
  const sensitivityFactor = 70 / weightKg;
  const baseRise = 0.25;
  const effectiveRise = baseRise * sensitivityFactor;
  const carbsNeeded = Math.ceil(bgDifference / effectiveRise);
  const glucoseTablets = Math.ceil(carbsNeeded / 4);
  const juiceMl = Math.round(carbsNeeded * 10);
  return {
    carbsGrams: Math.max(carbsNeeded, 10),
    glucoseTablets: Math.max(glucoseTablets, 3),
    juiceMl: Math.max(juiceMl, 100),
    approximate: false,
  };
}
