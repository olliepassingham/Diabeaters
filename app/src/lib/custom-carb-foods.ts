import type { CarbFood } from "@/lib/carb-estimator-data";

const STORAGE_KEY = "diabeater_custom_carb_foods_v1";
const PORTION_ID = "serving";

type StoredCustomCarbFood = {
  id: string;
  name: string;
  carbGrams: number;
  createdAt: string;
};

function readStored(): StoredCustomCarbFood[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredCustomCarbFood => {
      if (!item || typeof item !== "object") return false;
      const row = item as StoredCustomCarbFood;
      return typeof row.id === "string" && typeof row.name === "string" && typeof row.carbGrams === "number";
    });
  } catch {
    return [];
  }
}

function writeStored(rows: StoredCustomCarbFood[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function slug(name: string): string {
  return name
    .toLocaleLowerCase("en-GB")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function customCarbFoodId(name: string): string {
  return `custom-${slug(name) || "food"}`;
}

function toCarbFood(row: StoredCustomCarbFood): CarbFood {
  const grams = Math.round(row.carbGrams * 10) / 10;
  return {
    id: row.id,
    name: row.name,
    aliases: [],
    category: "meals",
    portions: [
      {
        id: PORTION_ID,
        label: "Your amount",
        carbsGrams: grams,
        uncertaintyPercent: 15,
      },
    ],
  };
}

export function listCustomCarbFoods(): CarbFood[] {
  return readStored().map(toCarbFood);
}

/** Save a name and carb amount the person entered. Same name updates the saved amount. */
export function saveCustomCarbFood(name: string, carbGrams: number): CarbFood | null {
  const cleaned = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (cleaned.length < 2) return null;
  if (!Number.isFinite(carbGrams) || carbGrams < 0 || carbGrams > 250) return null;
  const grams = Math.round(carbGrams * 10) / 10;
  const id = customCarbFoodId(cleaned);
  const rows = readStored().filter((row) => row.id !== id);
  const next: StoredCustomCarbFood = {
    id,
    name: cleaned,
    carbGrams: grams,
    createdAt: new Date().toISOString(),
  };
  writeStored([next, ...rows].slice(0, 80));
  return toCarbFood(next);
}
