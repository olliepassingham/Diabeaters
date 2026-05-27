import type { UserProfile } from "@/lib/storage";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";

export type WeightDisplayUnit = "kg" | "lbs";

const LBS_PER_KG = 0.45359237;

/** Valid stored profile weight in kg. */
export function getBodyWeightKgFromProfile(profile: Partial<UserProfile> | null | undefined): number | null {
  const kg = profile?.bodyWeightKg;
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) return null;
  return kg;
}

export function getWeightDisplayUnitFromProfile(
  profile: Partial<UserProfile> | null | undefined,
): WeightDisplayUnit {
  return profile?.weightDisplayUnit === "lbs" ? "lbs" : "kg";
}

/** Parse a weight field in the given display unit; returns kg or null if empty/invalid. */
export function parseWeightInputToKg(value: string, unit: WeightDisplayUnit): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === "lbs" ? n * LBS_PER_KG : n;
}

export function kgToDisplayValue(kg: number, unit: WeightDisplayUnit): number {
  return unit === "lbs" ? kg / LBS_PER_KG : kg;
}

/** Format kg for an input field in the chosen display unit (no unit suffix). */
export function formatWeightInputFromKg(kg: number, unit: WeightDisplayUnit): string {
  const v = kgToDisplayValue(kg, unit);
  const rounded = unit === "kg" ? Math.round(v * 10) / 10 : Math.round(v);
  return String(rounded);
}

/** Human-readable label, e.g. "70 kg" or "154 lbs". */
export function formatWeightLabel(kg: number, unit: WeightDisplayUnit): string {
  const v = kgToDisplayValue(kg, unit);
  const display = unit === "kg" ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString();
  return `${display} ${unit}`;
}

export type ResolveHypoWeightResult =
  | { ok: true; weightKg: number; fromProfile: boolean }
  | { ok: false; error: string };

/**
 * Weight for hypo carbohydrate estimate: profile weight unless the user entered a custom value.
 */
export function resolveHypoCalculatorWeightKg(input: {
  profile: Partial<UserProfile>;
  useProfileWeight: boolean;
  inputValue: string;
  inputUnit: WeightDisplayUnit;
}): ResolveHypoWeightResult {
  const weightRequired = hypoCalculatorRequiresExplicitWeight(input.profile.dateOfBirth);
  const profileKg = getBodyWeightKgFromProfile(input.profile);

  if (input.useProfileWeight && profileKg != null) {
    return { ok: true, weightKg: profileKg, fromProfile: true };
  }

  const fromInput = parseWeightInputToKg(input.inputValue, input.inputUnit);
  if (fromInput != null) {
    return { ok: true, weightKg: fromInput, fromProfile: false };
  }

  if (weightRequired) {
    return {
      ok: false,
      error: "Add your weight in Settings (or below) so we do not assume an adult default.",
    };
  }

  return { ok: true, weightKg: 70, fromProfile: false };
}

export function profileWeightRequiredForHypo(dateOfBirth: string | null | undefined): boolean {
  return hypoCalculatorRequiresExplicitWeight(dateOfBirth);
}
