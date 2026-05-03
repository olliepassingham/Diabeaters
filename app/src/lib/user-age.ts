/**
 * Client-side age helpers from profile date of birth (YYYY-MM-DD).
 * Logic matches `ageInWholeYearsUtc` in `supabase/functions/_shared/ai-coach/contextPacker.ts`
 * — keep both in sync when changing rules.
 */

const ISO_DOB = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns trimmed `YYYY-MM-DD` or null when missing or malformed. */
export function normalizeDateOfBirthInput(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!ISO_DOB.test(t)) return null;
  return t;
}

/** Whole years since DOB using UTC calendar dates. */
export function ageInWholeYearsUtc(
  dateOfBirth: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const dob = normalizeDateOfBirthInput(dateOfBirth);
  if (!dob) return null;
  const m = ISO_DOB.exec(dob);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const ny = now.getUTCFullYear();
  const nm = now.getUTCMonth() + 1;
  const nd = now.getUTCDate();
  let age = ny - y;
  if (nm < mo || (nm === mo && nd < d)) age -= 1;
  if (!Number.isFinite(age) || age < 0 || age > 120) return null;
  return age;
}

export type UserAgeBand = "child" | "teen" | "adult";

/** `null` when DOB is unknown — callers should keep adult-default UI. */
export function getAgeBand(dateOfBirth: string | null | undefined, now?: Date): UserAgeBand | null {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return null;
  if (age < 13) return "child";
  if (age < 18) return "teen";
  return "adult";
}

/** When DOB is unknown, allow (same as server coach context). */
export function canShowAlcoholScenarios(dateOfBirth: string | null | undefined, now?: Date): boolean {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return true;
  return age >= 18;
}

/** UK learner car age 17; unknown DOB → allow. */
export function canShowDrivingReadiness(dateOfBirth: string | null | undefined, now?: Date): boolean {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return true;
  return age >= 17;
}

/** Under-18 with known age must not use an assumed adult weight in hypo math. */
export function hypoCalculatorRequiresExplicitWeight(
  dateOfBirth: string | null | undefined,
  now?: Date,
): boolean {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  return age != null && age < 18;
}
