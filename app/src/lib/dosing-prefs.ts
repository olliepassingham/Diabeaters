import type { UserSettings } from "@/lib/storage";

export type WeightDisplayUnit = "kg" | "lbs";

/** Insulin numbers and weight stored on the account so a new phone can restore them. */
export type DosingPrefs = {
  breakfastRatio: string | null;
  lunchRatio: string | null;
  dinnerRatio: string | null;
  snackRatio: string | null;
  correctionFactor: number | null;
  targetBgLow: number | null;
  targetBgHigh: number | null;
  bodyWeightKg: number | null;
  weightDisplayUnit: WeightDisplayUnit | null;
  updatedAt: string;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function ratioString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseDosingPrefs(raw: unknown): DosingPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt.trim() : "";
  if (!updatedAt) return null;
  const unit = row.weightDisplayUnit === "lbs" || row.weightDisplayUnit === "kg" ? row.weightDisplayUnit : null;
  return {
    breakfastRatio: ratioString(row.breakfastRatio),
    lunchRatio: ratioString(row.lunchRatio),
    dinnerRatio: ratioString(row.dinnerRatio),
    snackRatio: ratioString(row.snackRatio),
    correctionFactor: finiteNumber(row.correctionFactor),
    targetBgLow: finiteNumber(row.targetBgLow),
    targetBgHigh: finiteNumber(row.targetBgHigh),
    bodyWeightKg: finiteNumber(row.bodyWeightKg),
    weightDisplayUnit: unit,
    updatedAt,
  };
}

export function buildDosingPrefs(input: {
  settings: UserSettings;
  bodyWeightKg?: number;
  weightDisplayUnit?: WeightDisplayUnit;
  updatedAt: string;
}): DosingPrefs {
  return {
    breakfastRatio: input.settings.breakfastRatio?.trim() || null,
    lunchRatio: input.settings.lunchRatio?.trim() || null,
    dinnerRatio: input.settings.dinnerRatio?.trim() || null,
    snackRatio: input.settings.snackRatio?.trim() || null,
    correctionFactor:
      typeof input.settings.correctionFactor === "number" && Number.isFinite(input.settings.correctionFactor)
        ? input.settings.correctionFactor
        : null,
    targetBgLow:
      typeof input.settings.targetBgLow === "number" && Number.isFinite(input.settings.targetBgLow)
        ? input.settings.targetBgLow
        : null,
    targetBgHigh:
      typeof input.settings.targetBgHigh === "number" && Number.isFinite(input.settings.targetBgHigh)
        ? input.settings.targetBgHigh
        : null,
    bodyWeightKg:
      typeof input.bodyWeightKg === "number" && Number.isFinite(input.bodyWeightKg) && input.bodyWeightKg > 0
        ? input.bodyWeightKg
        : null,
    weightDisplayUnit: input.weightDisplayUnit ?? null,
    updatedAt: input.updatedAt,
  };
}

export function localDosingHasValues(settings: UserSettings, bodyWeightKg?: number): boolean {
  return Boolean(
    settings.breakfastRatio ||
      settings.lunchRatio ||
      settings.dinnerRatio ||
      settings.snackRatio ||
      settings.correctionFactor ||
      settings.targetBgLow ||
      settings.targetBgHigh ||
      (typeof bodyWeightKg === "number" && bodyWeightKg > 0),
  );
}

/**
 * A new phone (nothing saved locally) takes the account copy.
 * A phone that already has numbers but has never stamped them keeps those numbers
 * until the next save, which then uploads them.
 */
export function shouldApplyCloudDosingPrefs(input: {
  localUpdatedAt?: string;
  localHasValues: boolean;
  cloudUpdatedAt: string;
}): boolean {
  if (!input.cloudUpdatedAt) return false;
  if (input.localUpdatedAt && input.localUpdatedAt >= input.cloudUpdatedAt) return false;
  if (!input.localUpdatedAt && input.localHasValues) return false;
  return true;
}
