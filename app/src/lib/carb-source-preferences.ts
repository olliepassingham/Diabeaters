import {
  formatPrimaryTreatmentShort,
  getPrimaryHypoTreatmentFromProfile,
  normalizePrimaryHypoTreatment,
  PRIMARY_HYPO_TREATMENT_OPTIONS,
  type PrimaryHypoTreatment,
} from "@/lib/hypo-treatment-display";
import type { UserProfile } from "@/lib/storage";

export type CarbSourceScenario = "hypo" | "exercise_on_hand" | "exercise_during" | "driving";

export type CarbSourceFavorite = {
  id: string;
  label: string;
  carbsPerServing: number;
  unitLabel: string;
  notes?: string;
};

export type CarbSourcePreferences = {
  favorites: CarbSourceFavorite[];
  defaultByScenario: Partial<Record<CarbSourceScenario, string>>;
};

export const MAX_CARB_SOURCE_FAVORITES = 8;

export const CARB_SOURCE_SCENARIO_LABELS: Record<
  CarbSourceScenario,
  { title: string; description: string }
> = {
  hypo: {
    title: "Treating a hypo",
    description: "Hypo help and quick hypo logging",
  },
  exercise_on_hand: {
    title: "Exercise — on hand",
    description: "Fast carbs to carry before you start",
  },
  exercise_during: {
    title: "Exercise — during session",
    description: "Gels, drink, or chews while you move",
  },
  driving: {
    title: "Driving / in the car",
    description: "Driving readiness reminders",
  },
};

export const CARB_SOURCE_SCENARIO_ORDER: CarbSourceScenario[] = [
  "hypo",
  "exercise_on_hand",
  "exercise_during",
  "driving",
];

export type CarbSourceTemplate = {
  label: string;
  carbsPerServing: number;
  unitLabel: string;
  notes?: string;
};

export const COMMON_CARB_SOURCE_TEMPLATES: CarbSourceTemplate[] = [
  { label: "Glucose tablets", carbsPerServing: 4, unitLabel: "tablet" },
  { label: "Glucose gel", carbsPerServing: 15, unitLabel: "gel tube" },
  { label: "Running gel", carbsPerServing: 22, unitLabel: "gel" },
  { label: "Fruit juice", carbsPerServing: 15, unitLabel: "150ml juice" },
  { label: "Sugary drink", carbsPerServing: 26, unitLabel: "330ml can" },
  { label: "Jelly babies", carbsPerServing: 5, unitLabel: "sweet" },
];

const PRESET_FROM_PRIMARY: Record<
  Exclude<PrimaryHypoTreatment, "other">,
  CarbSourceTemplate
> = {
  glucose_tablets: { label: "Glucose tablets", carbsPerServing: 4, unitLabel: "tablet" },
  juice: { label: "Fruit juice", carbsPerServing: 15, unitLabel: "150ml juice" },
  jelly_babies: { label: "Jelly babies", carbsPerServing: 5, unitLabel: "sweet" },
  glucose_gel: { label: "Glucose gel", carbsPerServing: 15, unitLabel: "gel tube" },
  sugary_drink: { label: "Sugary drink", carbsPerServing: 26, unitLabel: "330ml can" },
  sweets: { label: "Sweets", carbsPerServing: 5, unitLabel: "sweet" },
};

export type ResolvedCarbSource =
  | { kind: "favorite"; favorite: CarbSourceFavorite }
  | { kind: "preset"; treatment: PrimaryHypoTreatment };

function newFavoriteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `csf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeFavorite(raw: unknown): CarbSourceFavorite | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = String(r.label ?? "").trim();
  const carbsPerServing = Number(r.carbsPerServing);
  const unitLabel = String(r.unitLabel ?? "").trim();
  const id = String(r.id ?? "").trim();
  if (!label || !unitLabel || !Number.isFinite(carbsPerServing) || carbsPerServing <= 0 || !id) {
    return null;
  }
  const notes = typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : undefined;
  return { id, label, carbsPerServing, unitLabel, notes };
}

export function emptyCarbSourcePreferences(): CarbSourcePreferences {
  return { favorites: [], defaultByScenario: {} };
}

export function normalizeCarbSourcePreferences(raw: unknown): CarbSourcePreferences {
  if (!raw || typeof raw !== "object") return emptyCarbSourcePreferences();
  const r = raw as Record<string, unknown>;
  const favorites: CarbSourceFavorite[] = [];
  if (Array.isArray(r.favorites)) {
    for (const row of r.favorites) {
      const fav = normalizeFavorite(row);
      if (fav && !favorites.some((f) => f.id === fav.id)) {
        favorites.push(fav);
      }
    }
  }

  const defaultByScenario: Partial<Record<CarbSourceScenario, string>> = {};
  const defaultsRaw = r.defaultByScenario;
  if (defaultsRaw && typeof defaultsRaw === "object") {
    for (const scenario of CARB_SOURCE_SCENARIO_ORDER) {
      const id = (defaultsRaw as Record<string, unknown>)[scenario];
      if (typeof id === "string" && favorites.some((f) => f.id === id)) {
        defaultByScenario[scenario] = id;
      }
    }
  }

  return {
    favorites: favorites.slice(0, MAX_CARB_SOURCE_FAVORITES),
    defaultByScenario,
  };
}

/** Migrate legacy `primaryHypoTreatment` into favourites when none exist yet. */
export function migrateCarbSourcePreferences(profile: Partial<UserProfile> | null | undefined): CarbSourcePreferences {
  const existing = normalizeCarbSourcePreferences(profile?.carbSourcePreferences);
  if (existing.favorites.length > 0) return existing;

  const treatment = normalizePrimaryHypoTreatment(profile?.primaryHypoTreatment);
  if (!treatment || treatment === "other") return existing;

  const template = PRESET_FROM_PRIMARY[treatment];
  const favorite: CarbSourceFavorite = {
    id: newFavoriteId(),
    label: template.label,
    carbsPerServing: template.carbsPerServing,
    unitLabel: template.unitLabel,
    notes: template.notes,
  };

  return {
    favorites: [favorite],
    defaultByScenario: {
      hypo: favorite.id,
      driving: favorite.id,
    },
  };
}

export function getCarbSourcePreferences(profile: Partial<UserProfile> | null | undefined): CarbSourcePreferences {
  return migrateCarbSourcePreferences(profile);
}

export function convertGramsToServings(grams: number, carbsPerServing: number): number {
  if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(carbsPerServing) || carbsPerServing <= 0) {
    return 0;
  }
  const halves = Math.round((grams / carbsPerServing) * 2) / 2;
  if (halves < 0.5) return 0.5;
  return halves;
}

/** 0.5 → "½", 1 → "1", 1.5 → "1½" */
export function formatServingCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  const halves = Math.round(count * 2) / 2;
  const whole = Math.floor(halves);
  const frac = halves - whole;
  if (frac === 0.5) return whole === 0 ? "½" : `${whole}½`;
  return String(whole);
}

export function formatCarbsAsFavorite(grams: number, favorite: CarbSourceFavorite): string {
  const count = convertGramsToServings(grams, favorite.carbsPerServing);
  const servingGrams = count * favorite.carbsPerServing;
  if (servingGrams > grams * 1.5) {
    return `${favorite.label} is ${favorite.carbsPerServing}g each — use about ${Math.round(grams)}g`;
  }
  const countLabel = formatServingCount(count);
  return `about ${countLabel} ${favorite.label}`;
}

export function formatCarbsAsFavoriteWithGrams(grams: number, favorite: CarbSourceFavorite): string {
  return `${formatCarbsAsFavorite(grams, favorite)} (≈${Math.round(grams)}g)`;
}

export function resolveCarbSource(
  profile: Partial<UserProfile> | null | undefined,
  scenario: CarbSourceScenario,
): ResolvedCarbSource | null {
  const prefs = getCarbSourcePreferences(profile);
  const favId = prefs.defaultByScenario[scenario];
  if (favId) {
    const favorite = prefs.favorites.find((f) => f.id === favId);
    if (favorite) return { kind: "favorite", favorite };
  }

  const treatment = getPrimaryHypoTreatmentFromProfile(profile);
  if (treatment && treatment !== "other") {
    return { kind: "preset", treatment };
  }
  return null;
}

export function formatCarbsForScenario(
  grams: number,
  profile: Partial<UserProfile> | null | undefined,
  scenario: CarbSourceScenario,
): string | null {
  const resolved = resolveCarbSource(profile, scenario);
  if (!resolved) return null;
  if (resolved.kind === "favorite") {
    return formatCarbsAsFavorite(grams, resolved.favorite);
  }
  return formatPrimaryTreatmentShort(grams, resolved.treatment);
}

export function formatFastCarbsForScenario(
  grams: number,
  profile: Partial<UserProfile> | null | undefined,
  scenario: CarbSourceScenario,
  opts?: { prefix?: string },
): string {
  const prefix = opts?.prefix ?? "~";
  const gramsLine = `${prefix}${Math.round(grams)}g fast carbs`;
  const primary = formatCarbsForScenario(grams, profile, scenario);
  if (!primary) return gramsLine;
  return `${gramsLine} · ${primary}`;
}

export function carbSourceLogLabel(
  profile: Partial<UserProfile> | null | undefined,
  scenario: CarbSourceScenario,
): string | null {
  const resolved = resolveCarbSource(profile, scenario);
  if (!resolved) return null;
  if (resolved.kind === "favorite") return resolved.favorite.label;
  return PRIMARY_HYPO_TREATMENT_OPTIONS.find((o) => o.value === resolved.treatment)?.logLabel ?? null;
}

export function createFavoriteFromTemplate(template: CarbSourceTemplate): CarbSourceFavorite {
  return {
    id: newFavoriteId(),
    label: template.label,
    carbsPerServing: template.carbsPerServing,
    unitLabel: template.unitLabel,
    notes: template.notes,
  };
}

export function carbSourcePreferencesToCloud(prefs: CarbSourcePreferences): CarbSourcePreferences {
  return normalizeCarbSourcePreferences(prefs);
}

export function carbSourcePreferencesFromCloud(raw: unknown): CarbSourcePreferences | null {
  const normalized = normalizeCarbSourcePreferences(raw);
  if (normalized.favorites.length === 0 && Object.keys(normalized.defaultByScenario).length === 0) {
    return null;
  }
  return normalized;
}
