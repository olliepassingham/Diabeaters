import { UK_DEFAULT_UNITS_PER_INSULIN_PEN } from "@/lib/insulin-pen-units";
import { storage, type Supply } from "@/lib/storage";

/** Typical UK one-collection starter — edit to match real stock. */
export const STARTER_SUPPLY_NOTE =
  "Starter example — typical one pharmacy collection. Edit to match your stock.";

export const STARTER_CGM_SEEDED_KEY = "diabeaters_starter_cgm_seeded_v1";

/** One collection: five 300u pens, one needle box, ~1 month Libre-style sensors. */
export const STARTER_MDI_PEN_COUNT = 5;
export const STARTER_NEEDLE_COUNT = 100;
export const STARTER_CGM_SENSOR_COUNT = 2;

export function todayNoonIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function unitsForStarterPens(penCount: number): number {
  const settings = storage.getSettings();
  const perPen =
    typeof settings.unitsPerInsulinPen === "number" && settings.unitsPerInsulinPen > 0
      ? settings.unitsPerInsulinPen
      : UK_DEFAULT_UNITS_PER_INSULIN_PEN;
  return penCount * perPen;
}

export function hasStarterCgmBeenSeeded(): boolean {
  try {
    return localStorage.getItem(STARTER_CGM_SEEDED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markStarterCgmSeeded(): void {
  try {
    localStorage.setItem(STARTER_CGM_SEEDED_KEY, "1");
  } catch {
    // ignore
  }
}

export function starterCgmSupplyRow(): Omit<Supply, "id"> {
  const started = todayNoonIso();
  return {
    name: "CGM Sensors",
    type: "cgm",
    currentQuantity: STARTER_CGM_SENSOR_COUNT,
    dailyUsage: 0,
    activeItemStartDate: started,
    lastPickupDate: started,
    quantityAtPickup: STARTER_CGM_SENSOR_COUNT,
    notes: STARTER_SUPPLY_NOTE,
  };
}
