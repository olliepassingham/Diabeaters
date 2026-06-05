import type { UserProfile } from "@/lib/storage";

/** User's usual first-line hypo treatment (stored on profile). */
export type PrimaryHypoTreatment =
  | "glucose_tablets"
  | "juice"
  | "jelly_babies"
  | "glucose_gel"
  | "sugary_drink"
  | "sweets"
  | "other";

export const PRIMARY_HYPO_TREATMENT_OPTIONS: {
  value: PrimaryHypoTreatment;
  label: string;
  /** Value stored on hypo log entries when logging from dashboard. */
  logLabel: string;
}[] = [
  { value: "glucose_tablets", label: "Glucose tablets", logLabel: "Glucose tablets" },
  { value: "juice", label: "Fruit juice", logLabel: "Juice" },
  { value: "jelly_babies", label: "Jelly babies / sweets", logLabel: "Sweets" },
  { value: "glucose_gel", label: "Glucose gel", logLabel: "Gel" },
  { value: "sugary_drink", label: "Sugary drink (not diet)", logLabel: "Sugary drink" },
  { value: "sweets", label: "Other sweets / candy", logLabel: "Sweets" },
  { value: "other", label: "Other / team plan only", logLabel: "Other" },
];

const VALID: PrimaryHypoTreatment[] = PRIMARY_HYPO_TREATMENT_OPTIONS.map((o) => o.value);

export function normalizePrimaryHypoTreatment(raw: unknown): PrimaryHypoTreatment | undefined {
  if (typeof raw !== "string") return undefined;
  return VALID.includes(raw as PrimaryHypoTreatment) ? (raw as PrimaryHypoTreatment) : undefined;
}

export function getPrimaryHypoTreatmentFromProfile(
  profile: Partial<UserProfile> | null | undefined,
): PrimaryHypoTreatment | undefined {
  return normalizePrimaryHypoTreatment(profile?.primaryHypoTreatment);
}

export function primaryHypoTreatmentLogLabel(treatment: PrimaryHypoTreatment): string {
  return PRIMARY_HYPO_TREATMENT_OPTIONS.find((o) => o.value === treatment)?.logLabel ?? "Other";
}

export type HypoCarbEquivalents = {
  carbsGrams: number;
  glucoseTablets: number;
  juiceMl: number;
  jellyBabies: number;
};

/** Convert a carb gram target into common treatment amounts (educational defaults). */
export function computeHypoCarbEquivalents(carbsGrams: number): HypoCarbEquivalents {
  const carbs = Math.max(0, Math.round(carbsGrams));
  const glucoseTablets = Math.ceil(carbs / 4);
  const juiceMl = Math.round(carbs * 10);
  const jellyBabies = Math.ceil(carbs / 5);
  return {
    carbsGrams: Math.max(carbs, 10),
    glucoseTablets: Math.max(glucoseTablets, 3),
    juiceMl: Math.max(juiceMl, 100),
    jellyBabies: Math.max(jellyBabies, 2),
  };
}

export type PrimaryTreatmentAmount = {
  count: number;
  unitLabel: string;
  productLabel: string;
};

/** Map grams to the user's preferred treatment count (approximate). */
export function convertCarbsToPrimaryTreatment(
  carbsGrams: number,
  treatment: PrimaryHypoTreatment,
): PrimaryTreatmentAmount | null {
  if (treatment === "other") return null;
  const carbs = Math.max(0, carbsGrams);
  switch (treatment) {
    case "glucose_tablets":
      return {
        count: Math.max(Math.ceil(carbs / 4), 1),
        unitLabel: "glucose tablets",
        productLabel: "Glucose tablets",
      };
    case "juice":
      return {
        count: Math.max(Math.round(carbs * 10), 50),
        unitLabel: "ml fruit juice",
        productLabel: "Fruit juice",
      };
    case "jelly_babies":
      return {
        count: Math.max(Math.ceil(carbs / 5), 1),
        unitLabel: "jelly babies",
        productLabel: "Jelly babies",
      };
    case "sweets":
      return {
        count: Math.max(Math.ceil(carbs / 5), 1),
        unitLabel: "sweets",
        productLabel: "Sweets",
      };
    case "glucose_gel":
      return {
        count: Math.max(Math.ceil(carbs / 15), 1),
        unitLabel: carbs <= 15 ? "glucose gel tube" : "glucose gel tubes",
        productLabel: "Glucose gel",
      };
    case "sugary_drink":
      return {
        count: Math.max(Math.round(carbs * 10), 50),
        unitLabel: "ml sugary drink",
        productLabel: "Sugary drink",
      };
    default:
      return null;
  }
}

/** e.g. "about 4 glucose tablets" */
export function formatPrimaryTreatmentShort(
  carbsGrams: number,
  treatment: PrimaryHypoTreatment | undefined,
): string | null {
  if (!treatment || treatment === "other") return null;
  const converted = convertCarbsToPrimaryTreatment(carbsGrams, treatment);
  if (!converted) return null;
  const { count, unitLabel } = converted;
  if (treatment === "glucose_gel" && count > 1) {
    return `about ${count} glucose gel tubes`;
  }
  return `about ${count} ${unitLabel}`;
}

/** e.g. "about 4 glucose tablets (≈15g fast carbs)" */
export function formatPrimaryTreatmentWithCarbs(
  carbsGrams: number,
  treatment: PrimaryHypoTreatment | undefined,
): string | null {
  const short = formatPrimaryTreatmentShort(carbsGrams, treatment);
  if (!short) return null;
  return `${short} (≈${Math.round(carbsGrams)}g fast carbs)`;
}

/** Line for inline copy: "~15g fast carbs · about 4 glucose tablets" */
export function formatFastCarbsWithPrimaryTreatment(
  carbsGrams: number,
  treatment: PrimaryHypoTreatment | undefined,
  opts?: { prefix?: string },
): string {
  const prefix = opts?.prefix ?? "~";
  const grams = `${prefix}${Math.round(carbsGrams)}g fast carbs`;
  const primary = formatPrimaryTreatmentShort(carbsGrams, treatment);
  if (!primary) return grams;
  return `${grams} · ${primary}`;
}

export {
  formatCarbsForScenario,
  formatFastCarbsForScenario,
  getCarbSourcePreferences,
  carbSourceLogLabel,
  resolveCarbSource,
  type CarbSourceScenario,
} from "@/lib/carb-source-preferences";
