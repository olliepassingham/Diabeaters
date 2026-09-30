import type { AlcoholIntensity } from "@/lib/alcohol-night-tool";

/** How a drink usually behaves. Educational only — not a glucose forecast. */
export type AlcoholDrinkPatternId =
  | "carb_then_low"
  | "low_carb_later_low"
  | "later_low"
  | "low_alcohol";

export type AlcoholDrink = {
  id: string;
  name: string;
  /** Common UK serving this carb figure refers to. */
  servingLabel: string;
  carbsGrams: number;
  /** Expected variation from brand, sweetness, and the exact pour. */
  uncertaintyPercent: number;
  patternId: AlcoholDrinkPatternId;
};

export const ALCOHOL_DRINK_CARB_NOTE = "Typical figures. Brands vary — check the bottle or can.";

export const ALCOHOL_DRINK_PATTERNS: Record<AlcoholDrinkPatternId, string> = {
  carb_then_low:
    "Carbs can raise glucose first. The alcohol can bring a low later, often overnight.",
  low_carb_later_low: "Fewer carbs, so less of a rise. The later low still matters.",
  later_low: "Almost no carbs, so the later low is the main pattern.",
  low_alcohol: "The carb line still applies. The later-low risk is smaller.",
};

/**
 * Typical UK servings. Carbs are round educational figures, not a label reading.
 */
export const ALCOHOL_DRINKS: AlcoholDrink[] = [
  {
    id: "pint-lager",
    name: "Pint of lager",
    servingLabel: "568ml",
    carbsGrams: 14,
    uncertaintyPercent: 30,
    patternId: "carb_then_low",
  },
  {
    id: "half-lager",
    name: "Half pint of lager",
    servingLabel: "284ml",
    carbsGrams: 7,
    uncertaintyPercent: 30,
    patternId: "carb_then_low",
  },
  {
    id: "pint-cider",
    name: "Pint of cider",
    servingLabel: "568ml",
    carbsGrams: 20,
    uncertaintyPercent: 35,
    patternId: "carb_then_low",
  },
  {
    id: "wine-small",
    name: "Small glass of wine",
    servingLabel: "175ml, drier styles",
    carbsGrams: 2,
    uncertaintyPercent: 50,
    patternId: "low_carb_later_low",
  },
  {
    id: "wine-large",
    name: "Large glass of wine",
    servingLabel: "250ml, drier styles",
    carbsGrams: 3,
    uncertaintyPercent: 50,
    patternId: "low_carb_later_low",
  },
  {
    id: "prosecco",
    name: "Glass of prosecco",
    servingLabel: "125ml",
    carbsGrams: 2,
    uncertaintyPercent: 50,
    patternId: "low_carb_later_low",
  },
  {
    id: "spirit-diet",
    name: "Single spirit, diet mixer",
    servingLabel: "25ml plus diet mixer",
    carbsGrams: 0,
    uncertaintyPercent: 0,
    patternId: "later_low",
  },
  {
    id: "spirit-sugar",
    name: "Single spirit, sugary mixer",
    servingLabel: "25ml plus full-sugar mixer",
    carbsGrams: 20,
    uncertaintyPercent: 30,
    patternId: "carb_then_low",
  },
  {
    id: "alcopop",
    name: "Alcopop",
    servingLabel: "275ml bottle",
    carbsGrams: 28,
    uncertaintyPercent: 25,
    patternId: "carb_then_low",
  },
  {
    id: "cocktail",
    name: "Sugary cocktail",
    servingLabel: "One glass",
    carbsGrams: 25,
    uncertaintyPercent: 40,
    patternId: "carb_then_low",
  },
  {
    id: "low-alcohol-beer",
    name: "Low-alcohol beer",
    servingLabel: "Pint",
    carbsGrams: 15,
    uncertaintyPercent: 35,
    patternId: "low_alcohol",
  },
];

export type AlcoholDrinkSelection = {
  id: string;
  count: number;
};

export type AlcoholDrinkSummary = {
  drinkCount: number;
  carbsGrams: number;
  labels: string[];
  patternLines: string[];
  suggestedIntensity: AlcoholIntensity | null;
};

export function alcoholDrinkById(id: string): AlcoholDrink | undefined {
  return ALCOHOL_DRINKS.find((drink) => drink.id === id);
}

/** One drink leans light, two or three moderate, four or more heavier. */
export function suggestAlcoholIntensity(drinkCount: number): AlcoholIntensity | null {
  if (!Number.isFinite(drinkCount) || drinkCount <= 0) return null;
  if (drinkCount === 1) return "light";
  if (drinkCount <= 3) return "moderate";
  return "long_or_heavy";
}

export function summarizeAlcoholDrinks(selections: AlcoholDrinkSelection[]): AlcoholDrinkSummary {
  const labels: string[] = [];
  const patternIds: AlcoholDrinkPatternId[] = [];
  let drinkCount = 0;
  let carbsGrams = 0;

  for (const selection of selections) {
    const count = Math.floor(selection.count);
    if (count <= 0) continue;
    const drink = alcoholDrinkById(selection.id);
    if (!drink) continue;
    drinkCount += count;
    carbsGrams += drink.carbsGrams * count;
    labels.push(count > 1 ? `${count} × ${drink.name}` : drink.name);
    if (!patternIds.includes(drink.patternId)) patternIds.push(drink.patternId);
  }

  return {
    drinkCount,
    carbsGrams,
    labels,
    patternLines: patternIds.map((id) => ALCOHOL_DRINK_PATTERNS[id]),
    suggestedIntensity: suggestAlcoholIntensity(drinkCount),
  };
}

/** Carb box text for the account's carb unit. One CP is 10g. */
export function formatAlcoholDrinkCarbsForField(carbsGrams: number, carbUnit: "grams" | "cp"): string {
  const grams = Math.max(0, Math.round(carbsGrams));
  if (carbUnit === "grams") return String(grams);
  if (grams === 0) return "0";
  const cp = grams / 10;
  return cp < 1 ? cp.toFixed(1) : String(Math.round(cp));
}
