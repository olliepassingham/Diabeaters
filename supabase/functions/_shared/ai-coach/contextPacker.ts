/**
 * Context packer (§3 of docs/regulatory/ai_coach_system_prompt.md).
 *
 * Builds the privacy-minimised JSON document that the Edge Function prepends
 * to the LLM prompt under the role/marker `context`. PII is never included:
 * no name, email, postcode, raw timestamps with times, or free-text notes.
 *
 * v1 reads only what we need from `profiles` (age band derived from DOB,
 * delivery method, BG units, diagnosed years ago) and trusts a client-built
 * `lastFortnight` summary (numbers + booleans only).
 *
 * Pure logic — runs under both Deno and Vitest.
 */

import type { MatchedAppGuide } from "./appGuides.ts";
import { ALLOWED_HREFS, type CoachContext, type CoachSavedMeal, type CoachSuppliesSummary, type CoachToolId, type CoachTravelTripStyle } from "./types.ts";

const SPARSE_BG_THRESHOLD = 14;
const SPARSE_EXERCISE_THRESHOLD = 1;

export interface ProfileInput {
  /** ISO date string `YYYY-MM-DD` from `profiles.date_of_birth`. */
  dateOfBirth?: string | null;
  /** `mdi` | `pump` | other; from `profiles.insulin_delivery_method`. */
  insulinDeliveryMethod?: string | null;
  /** `mmol/L` | `mg/dL`; from `profiles.bg_units` (or local default). */
  bgUnits?: string | null;
  /** ISO date `YYYY-MM-DD` from `profiles.diabetes_onset_date`. */
  diabetesOnsetDate?: string | null;
  /** `grams` | `portions`; from local profile when synced via device setup hint. */
  carbUnits?: string | null;
  /** Whether the user tracks CGM (device setup hint). */
  usesCgm?: boolean | null;
  /** Closed-loop / automation on pump (device setup hint). */
  usesClosedLoop?: boolean | null;
}

export interface LastFortnightInput {
  bgReadings: number;
  estimatedTimeInRangePct: number | null;
  hypoCount: number;
  severeHypoCount: number;
  highCount: number;
  exerciseSessions: number;
  sickDayActive: boolean;
  travelModeActive: boolean;
  travelTripStyle?: CoachTravelTripStyle;
}

export interface PackContextInput {
  profile: ProfileInput;
  lastFortnight: LastFortnightInput;
  ratiosAreSet: boolean;
  /** Optional client-provided pharmacy opening status. */
  pharmacyStatus?: CoachContext["pharmacy"];
  /** Optional server-derived supply snapshot (counts / categories only). */
  suppliesSummary?: CoachSuppliesSummary;
  /** Optional: override "now" for deterministic tests. */
  now?: Date;
  /** Guide matched from the latest message. Dropped when the href is not allowed for this profile. */
  matchedGuide?: MatchedAppGuide | null;
  /** Client meal names and carb grams. Sanitised; dose-like names are dropped. */
  savedMeals?: unknown;
  /** Client tool ids. Unknown ids are dropped. */
  toolsUsed?: unknown;
}

const TOOL_IDS: ReadonlySet<CoachToolId> = new Set([
  "routines",
  "supplies",
  "exercise",
  "hypos",
  "appointments",
  "travel",
  "sick-day",
]);

const DOSE_LIKE_NAME = /\d+\s*(u|iu|units?)\b/i;
const RATIO_LIKE_NAME = /\d+\s*:\s*\d+/;

function guideBlockedForProfile(href: string, profile: CoachContext["profile"]): boolean {
  if (href !== "/scenarios/alcohol" && href !== "/scenarios/driving") return false;
  const years = profile.ageYears;
  if (years == null) return true;
  if (href === "/scenarios/alcohol") return years < 18;
  return years < 17;
}

function sanitizeMatchedGuide(
  raw: MatchedAppGuide | null | undefined,
  profile: CoachContext["profile"],
): CoachContext["matchedGuide"] {
  if (!raw) return undefined;
  if (!ALLOWED_HREFS.includes(raw.href as (typeof ALLOWED_HREFS)[number])) return undefined;
  if (guideBlockedForProfile(raw.href, profile)) return undefined;
  const label = raw.label.replace(/\s+/g, " ").trim().slice(0, 40);
  const excerpt = raw.excerpt.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!label || excerpt.length < 20) return undefined;
  return { href: raw.href, label, excerpt };
}

function sanitizeSavedMeals(raw: unknown): CoachSavedMeal[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const meals: CoachSavedMeal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { name?: unknown; carbGrams?: unknown };
    const name = typeof row.name === "string" ? row.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (name.length < 2) continue;
    if (DOSE_LIKE_NAME.test(name) || RATIO_LIKE_NAME.test(name)) continue;
    const carbs = typeof row.carbGrams === "number" ? row.carbGrams : Number.NaN;
    if (!Number.isFinite(carbs)) continue;
    const carbGrams = Math.round(carbs);
    if (carbGrams < 1 || carbGrams > 300) continue;
    meals.push({ name, carbGrams });
    if (meals.length >= 6) break;
  }
  return meals.length ? meals : undefined;
}

function sanitizeToolsUsed(raw: unknown): CoachToolId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tools: CoachToolId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim().toLowerCase() as CoachToolId;
    if (!TOOL_IDS.has(id) || tools.includes(id)) continue;
    tools.push(id);
  }
  return tools.length ? tools : undefined;
}

function sanitizeSuppliesSummary(s: CoachSuppliesSummary): CoachSuppliesSummary {
  const capSlots = 200;
  const tracked = Math.min(capSlots, Math.max(0, Math.floor(s.trackedSlots)));
  const critical = Math.min(tracked, Math.max(0, Math.floor(s.criticalOrEmptySlots)));
  const slotsByCategory: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.slotsByCategory ?? {})) {
    const kk = k.trim().toLowerCase().slice(0, 40);
    if (!kk) continue;
    const n = typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.floor(v))) : 0;
    if (n > 0) slotsByCategory[kk] = n;
  }
  return { trackedSlots: tracked, criticalOrEmptySlots: critical, slotsByCategory };
}

/** Whole years since DOB using UTC calendar dates (no PII beyond what DOB implies). */
export function ageInWholeYearsUtc(dobIso: string | null | undefined, now: Date): number | null {
  if (!dobIso || typeof dobIso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso.trim());
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

function ageBandFromDob(
  dob: string | null | undefined,
  now: Date,
): CoachContext["profile"]["ageBand"] {
  const ageYears = ageInWholeYearsUtc(dob, now);
  if (ageYears == null) return "unknown";
  if (ageYears < 18) return "under18";
  if (ageYears < 30) return "18-29";
  if (ageYears < 40) return "30-39";
  if (ageYears < 50) return "40-49";
  if (ageYears < 60) return "50-59";
  return "60+";
}

function deliveryMethodFrom(
  raw: string | null | undefined,
): CoachContext["profile"]["deliveryMethod"] {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "mdi" || v === "pen") return "mdi";
  if (v === "pump") return "pump";
  return "unknown";
}

function bgUnitsFrom(raw: string | null | undefined): CoachContext["profile"]["bgUnits"] {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "mmol/l" || v === "mmol") return "mmol/L";
  if (v === "mg/dl" || v === "mg/dl" || v === "mg") return "mg/dL";
  return "unknown";
}

function carbUnitsFrom(raw: string | null | undefined): CoachContext["profile"]["carbUnits"] {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "grams" || v === "gram" || v === "g") return "grams";
  if (v === "portions" || v === "portion") return "portions";
  return "unknown";
}

function cgmUseFrom(raw: boolean | null | undefined): CoachContext["profile"]["cgmUse"] {
  if (raw === true) return "yes";
  if (raw === false) return "no";
  return "unknown";
}

function closedLoopFrom(
  deliveryMethod: CoachContext["profile"]["deliveryMethod"],
  raw: boolean | null | undefined,
): CoachContext["profile"]["closedLoop"] {
  if (deliveryMethod !== "pump") return "not_applicable";
  if (raw === true) return "yes";
  if (raw === false) return "no";
  return "unknown";
}

function diagnosedYearsAgoFrom(
  raw: string | null | undefined,
  now: Date,
): number | null {
  if (!raw) return null;
  const onset = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(onset.getTime())) return null;
  const years = (now.getTime() - onset.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (!Number.isFinite(years) || years < 0) return null;
  return Math.floor(years);
}

function clampNonNegative(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v < 0 ? 0 : Math.floor(v);
}

function clampPercent(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function clampCoachTravelTripStyle(raw: unknown): CoachTravelTripStyle | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "relax" || v === "active" || v === "city" || v === "remote" || v === "family") return v;
  return undefined;
}

/**
 * Build the §3 context block. Only fields explicitly listed in `CoachContext`
 * are included; any extra keys on the inputs are dropped silently to prevent
 * accidental PII leakage.
 */
export function packContext(input: PackContextInput): CoachContext {
  const now = input.now ?? new Date();
  const dob = input.profile.dateOfBirth;
  const deliveryMethod = deliveryMethodFrom(input.profile.insulinDeliveryMethod);
  const profile: CoachContext["profile"] = {
    ageBand: ageBandFromDob(dob, now),
    ageYears: ageInWholeYearsUtc(dob, now),
    deliveryMethod,
    bgUnits: bgUnitsFrom(input.profile.bgUnits),
    carbUnits: carbUnitsFrom(input.profile.carbUnits),
    cgmUse: cgmUseFrom(input.profile.usesCgm),
    closedLoop: closedLoopFrom(deliveryMethod, input.profile.usesClosedLoop),
    diagnosedYearsAgo: diagnosedYearsAgoFrom(input.profile.diabetesOnsetDate, now),
  };

  const lf = input.lastFortnight;
  const travelTripStyle =
    lf.travelModeActive ? clampCoachTravelTripStyle(lf.travelTripStyle) : undefined;
  const lastFortnight: CoachContext["lastFortnight"] = {
    bgReadings: clampNonNegative(lf.bgReadings),
    estimatedTimeInRangePct: clampPercent(lf.estimatedTimeInRangePct),
    hypoCount: clampNonNegative(lf.hypoCount),
    severeHypoCount: clampNonNegative(lf.severeHypoCount),
    highCount: clampNonNegative(lf.highCount),
    exerciseSessions: clampNonNegative(lf.exerciseSessions),
    sickDayActive: Boolean(lf.sickDayActive),
    travelModeActive: Boolean(lf.travelModeActive),
    ...(travelTripStyle ? { travelTripStyle } : {}),
  };

  // Sparse-data flag tells the model to admit when it cannot answer pattern
  // questions honestly.
  const dataSparse =
    lastFortnight.bgReadings < SPARSE_BG_THRESHOLD &&
    lastFortnight.exerciseSessions <= SPARSE_EXERCISE_THRESHOLD;

  const supplies =
    input.suppliesSummary && input.suppliesSummary.trackedSlots > 0
      ? sanitizeSuppliesSummary(input.suppliesSummary)
      : undefined;

  const matchedGuide = sanitizeMatchedGuide(input.matchedGuide, profile);
  const savedMeals = sanitizeSavedMeals(input.savedMeals);
  const toolsUsed = sanitizeToolsUsed(input.toolsUsed);

  return {
    profile,
    ...(input.pharmacyStatus ? { pharmacy: input.pharmacyStatus } : {}),
    lastFortnight,
    ...(supplies ? { supplies } : {}),
    ratiosAreSet: Boolean(input.ratiosAreSet),
    dataSparse,
    ...(matchedGuide ? { matchedGuide } : {}),
    ...(savedMeals ? { savedMeals } : {}),
    ...(toolsUsed ? { toolsUsed } : {}),
  };
}
