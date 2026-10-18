import { isType2AppSession } from "@/lib/insulin-clinical-access";
import {
  hasStarterCgmBeenSeeded,
  markStarterCgmSeeded,
  starterCgmSupplyRow,
  STARTER_SUPPLY_NOTE,
  todayNoonIso,
} from "@/lib/starter-supply-shared";
import { storage, type Supply } from "@/lib/storage";

export const TYPE2_SUPPLIES_SEEDED_KEY = "diabeaters_type2_supplies_seeded_v1";

/** Typical UK Type 2 starter kit — edit to match real stock. */
export const STARTER_TYPE2_STRIP_COUNT = 50;
export const STARTER_TYPE2_LANCET_COUNT = 100;
export const STARTER_TYPE2_TABLET_COUNT = 56;

export function shouldSeedType2Supplies(): boolean {
  try {
    return localStorage.getItem(TYPE2_SUPPLIES_SEEDED_KEY) !== "1";
  } catch {
    return true;
  }
}

function markType2SuppliesSeeded(): void {
  try {
    localStorage.setItem(TYPE2_SUPPLIES_SEEDED_KEY, "1");
  } catch {
    // ignore
  }
}

function hasType2CoreSupplies(existing: Supply[]): boolean {
  const names = new Set(existing.map((s) => s.name.trim().toLowerCase()));
  return (
    names.has("blood glucose test strips") ||
    names.has("diabetes tablets") ||
    (existing.some((s) => s.type === "needle") && existing.some((s) => s.type === "other"))
  );
}

/**
 * Soft starter rows for Type 2: strips, lancets, tablets, and CGM if missing.
 * No insulin or pump kit. Safe to call repeatedly — one-shot per device.
 */
export function seedType2SuppliesIfNeeded(): { seeded: boolean; count: number } {
  if (!isType2AppSession(storage.getProfile())) {
    return { seeded: false, count: 0 };
  }

  if (!shouldSeedType2Supplies()) {
    return { seeded: false, count: 0 };
  }

  const existing = storage.getSupplies();
  if (hasType2CoreSupplies(existing)) {
    markType2SuppliesSeeded();
    if (existing.some((s) => s.type === "cgm")) markStarterCgmSeeded();
    return { seeded: false, count: 0 };
  }

  const started = todayNoonIso();
  const hasCgm = existing.some((s) => s.type === "cgm");
  const hasNeedle = existing.some((s) => s.type === "needle");

  const rows: Omit<Supply, "id">[] = [
    {
      name: "Blood glucose test strips",
      type: "other",
      currentQuantity: STARTER_TYPE2_STRIP_COUNT,
      dailyUsage: 0,
      lastPickupDate: started,
      quantityAtPickup: STARTER_TYPE2_STRIP_COUNT,
      notes: STARTER_SUPPLY_NOTE,
    },
    ...(hasNeedle
      ? []
      : [
          {
            name: "Lancets",
            type: "needle" as const,
            currentQuantity: STARTER_TYPE2_LANCET_COUNT,
            dailyUsage: 0,
            lastPickupDate: started,
            quantityAtPickup: STARTER_TYPE2_LANCET_COUNT,
            notes: STARTER_SUPPLY_NOTE,
          },
        ]),
    {
      name: "Diabetes tablets",
      type: "other",
      currentQuantity: STARTER_TYPE2_TABLET_COUNT,
      dailyUsage: 2,
      lastPickupDate: started,
      quantityAtPickup: STARTER_TYPE2_TABLET_COUNT,
      notes: `${STARTER_SUPPLY_NOTE} Rename to match your medicine (e.g. metformin).`,
    },
    ...(hasCgm || hasStarterCgmBeenSeeded() ? [] : [starterCgmSupplyRow()]),
  ];

  let count = 0;
  for (const row of rows) {
    storage.addSupply(row);
    count += 1;
  }

  markType2SuppliesSeeded();
  markStarterCgmSeeded();
  return { seeded: true, count };
}
