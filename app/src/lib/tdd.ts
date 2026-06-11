import type { UserSettings } from "@/lib/storage";

export type TddSettingsSlice = Pick<
  UserSettings,
  "tdd" | "shortActingUnitsPerDay" | "longActingUnitsPerDay"
>;

function positiveFinite(n: number | undefined | null): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** MDI short- + long-acting daily units when both are set. */
export function sumMdiDailyInsulinUnits(
  short?: number | null,
  long?: number | null,
): number | null {
  const s = positiveFinite(short ?? null);
  const l = positiveFinite(long ?? null);
  if (s == null || l == null) return null;
  return s + l;
}

/**
 * Effective TDD for dosing, sick day, travel, supplies, and completion checks.
 * Uses explicit `settings.tdd` when set; otherwise MDI short + long when both are present.
 */
export function getEffectiveTdd(settings: TddSettingsSlice): number | null {
  const explicit = positiveFinite(settings.tdd ?? null);
  if (explicit != null) return explicit;
  return sumMdiDailyInsulinUnits(settings.shortActingUnitsPerDay, settings.longActingUnitsPerDay);
}

/**
 * When an MDI user saves short- and long-acting daily units, keep `tdd` equal to their sum
 * so Ratios and the rest of the app share one total.
 */
export function reconcileTddFromMdiComponents(settings: TddSettingsSlice): number | undefined {
  const sum = sumMdiDailyInsulinUnits(settings.shortActingUnitsPerDay, settings.longActingUnitsPerDay);
  return sum ?? undefined;
}

/** Apply MDI reconciliation onto a settings object (returns a new object). */
export function withReconciledTdd<T extends TddSettingsSlice>(settings: T): T {
  const reconciled = reconcileTddFromMdiComponents(settings);
  if (reconciled == null) return settings;
  return { ...settings, tdd: reconciled };
}

export function hasConfiguredTdd(settings: TddSettingsSlice): boolean {
  return getEffectiveTdd(settings) != null;
}
