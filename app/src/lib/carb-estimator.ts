import {
  CARB_CATEGORY_LABELS,
  CARB_COMPOSITION_HINTS,
  CARB_FOODS,
  type CarbCompositionHint,
  type CarbFood,
  type CarbFoodCategory,
  type CarbPortion,
} from "@/lib/carb-estimator-data";

export type CarbEstimateSelection = {
  id: string;
  foodId: string;
  portionId: string;
  quantity: number;
};

export type CarbEstimatedItem = {
  selectionId: string;
  food: CarbFood;
  portion: CarbPortion;
  quantity: number;
  estimatedGrams: number;
  lowGrams: number;
  highGrams: number;
};

export type CarbMealEstimate = {
  items: CarbEstimatedItem[];
  estimatedGrams: number;
  suggestedGrams: number;
  lowGrams: number;
  highGrams: number;
  compositionHint: CarbCompositionHint | null;
};

export function normalizeCarbSearch(value: string): string {
  return value
    .toLocaleLowerCase("en-GB")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchScore(food: CarbFood, query: string): number {
  if (!query) return 1;
  const name = normalizeCarbSearch(food.name);
  const aliases = food.aliases.map(normalizeCarbSearch);
  const category = normalizeCarbSearch(CARB_CATEGORY_LABELS[food.category]);
  if (name === query || aliases.includes(query)) return 100;
  if (name.startsWith(query) || aliases.some((alias) => alias.startsWith(query))) return 80;
  if (name.includes(query) || aliases.some((alias) => alias.includes(query))) return 60;

  const terms = query.split(" ").filter(Boolean);
  const searchable = [name, category, ...aliases].join(" ");
  return terms.every((term) => searchable.includes(term)) ? 40 + terms.length : 0;
}

export function searchCarbFoods(
  query: string,
  options: { category?: CarbFoodCategory | "all"; limit?: number } = {},
): CarbFood[] {
  const normalized = normalizeCarbSearch(query);
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 12)));
  return CARB_FOODS
    .filter((food) => !options.category || options.category === "all" || food.category === options.category)
    .map((food, index) => ({ food, index, score: searchScore(food, normalized) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ food }) => food);
}

export function getCarbFood(foodId: string): CarbFood | null {
  return CARB_FOODS.find((food) => food.id === foodId) ?? null;
}

export function estimateCarbSelection(selection: CarbEstimateSelection): CarbEstimatedItem | null {
  const food = getCarbFood(selection.foodId);
  const portion = food?.portions.find((candidate) => candidate.id === selection.portionId);
  const quantity = Number(selection.quantity);
  if (!food || !portion || !Number.isFinite(quantity) || quantity <= 0 || quantity > 20) return null;

  const estimatedGrams = portion.carbsGrams * quantity;
  const variation = estimatedGrams * (portion.uncertaintyPercent / 100);
  return {
    selectionId: selection.id,
    food,
    portion,
    quantity,
    estimatedGrams,
    lowGrams: Math.max(0, estimatedGrams - variation),
    highGrams: estimatedGrams + variation,
  };
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function combineCompositionHints(items: CarbEstimatedItem[]): CarbCompositionHint | null {
  const hints = items
    .map((item) => CARB_COMPOSITION_HINTS[item.food.id])
    .filter((item): item is CarbCompositionHint => Boolean(item));
  if (!hints.length) return null;

  const meaningfulTypes = [...new Set(hints.map((item) => item.carbType).filter((type) => type !== "unsure"))];
  const carbType =
    meaningfulTypes.length === 0
      ? "unsure"
      : meaningfulTypes.length === 1
        ? meaningfulTypes[0]!
        : "balanced";
  return {
    carbType,
    hasFat: hints.some((item) => item.hasFat),
    hasProtein: hints.some((item) => item.hasProtein),
    hasFibre: hints.some((item) => item.hasFibre),
  };
}

export function estimateCarbMeal(selections: CarbEstimateSelection[]): CarbMealEstimate {
  const items = selections
    .map(estimateCarbSelection)
    .filter((item): item is CarbEstimatedItem => item !== null);
  const estimatedGrams = items.reduce((total, item) => total + item.estimatedGrams, 0);
  const lowGrams = items.reduce((total, item) => total + item.lowGrams, 0);
  const highGrams = items.reduce((total, item) => total + item.highGrams, 0);
  return {
    items,
    estimatedGrams: roundOne(estimatedGrams),
    suggestedGrams: Math.round(estimatedGrams),
    lowGrams: Math.floor(lowGrams),
    highGrams: Math.ceil(highGrams),
    compositionHint: combineCompositionHints(items),
  };
}
