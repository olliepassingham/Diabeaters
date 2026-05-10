/**
 * Client-side age helpers from profile date of birth (YYYY-MM-DD).
 * Logic matches `ageInWholeYearsUtc` in `supabase/functions/_shared/ai-coach/contextPacker.ts`
 * — keep both in sync when changing rules.
 *
 * Supporter invite defaults: `public.redeem_carer_invite` enables `clinical_settings` when
 * `EXTRACT(YEAR FROM AGE((timezone('UTC', now()))::date, profiles.date_of_birth)) < 13` — if you
 * change child/teen cutoffs here, update that migration too.
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

/**
 * `unknown` is returned when DOB is not on file. Adult-only routes (alcohol,
 * driving) and minor-aware tools (hypo calculator) treat `unknown` the same as
 * `under-18` so we never expose adult content to a child whose DOB has not been
 * captured.
 */
export type UserAgeBand = "child" | "teen" | "adult" | "unknown";

export function getAgeBand(dateOfBirth: string | null | undefined, now?: Date): UserAgeBand {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return "unknown";
  if (age < 13) return "child";
  if (age < 18) return "teen";
  return "adult";
}

/** True only when we know the user is 18+. Unknown DOB → false (default-deny). */
export function canShowAlcoholScenarios(dateOfBirth: string | null | undefined, now?: Date): boolean {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return false;
  return age >= 18;
}

/** UK learner car age 17. Unknown DOB → false (default-deny). */
export function canShowDrivingReadiness(dateOfBirth: string | null | undefined, now?: Date): boolean {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return false;
  return age >= 17;
}

/**
 * Hypo dose helpers must not assume an adult weight when the user is a known
 * minor or when DOB is missing. Either case requires an explicit weight input.
 */
export function hypoCalculatorRequiresExplicitWeight(
  dateOfBirth: string | null | undefined,
  now?: Date,
): boolean {
  const age = ageInWholeYearsUtc(dateOfBirth, now ?? new Date());
  if (age == null) return true;
  return age < 18;
}

/** True when the profile has no usable date of birth on file. */
export function isDateOfBirthUnknown(dateOfBirth: string | null | undefined): boolean {
  return ageInWholeYearsUtc(dateOfBirth) == null;
}
