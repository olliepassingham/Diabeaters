import { isPenDeliveryMethod, isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  hasStarterCgmBeenSeeded,
  markStarterCgmSeeded,
  starterCgmSupplyRow,
  STARTER_MDI_PEN_COUNT,
  STARTER_NEEDLE_COUNT,
  STARTER_SUPPLY_NOTE,
  todayNoonIso,
  unitsForStarterPens,
} from "@/lib/starter-supply-shared";
import { storage, type Supply } from "@/lib/storage";

export const MDI_SUPPLIES_SEEDED_KEY = "diabeaters_mdi_supplies_seeded_v1";

export {
  STARTER_CGM_SEEDED_KEY,
  STARTER_CGM_SENSOR_COUNT,
  STARTER_MDI_PEN_COUNT,
  STARTER_NEEDLE_COUNT,
  STARTER_SUPPLY_NOTE,
  hasStarterCgmBeenSeeded,
  markStarterCgmSeeded,
  starterCgmSupplyRow,
} from "@/lib/starter-supply-shared";

/** True when starter MDI rows have not been added yet for this device. */
export function shouldSeedMdiSupplies(): boolean {
  try {
    return localStorage.getItem(MDI_SUPPLIES_SEEDED_KEY) !== "1";
  } catch {
    return true;
  }
}

function markMdiSuppliesSeeded(): void {
  try {
    localStorage.setItem(MDI_SUPPLIES_SEEDED_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Add default MDI supply rows once (CGM, needles, short + long insulin).
 * Safe to call multiple times — no-ops when already seeded or any supplies exist.
 */
export function seedMdiSuppliesIfNeeded(): { seeded: boolean; count: number } {
  if (!shouldSeedMdiSupplies()) return { seeded: false, count: 0 };

  const profile = storage.getProfile();
  if (!isPenDeliveryMethod(profile?.insulinDeliveryMethod)) {
    return { seeded: false, count: 0 };
  }

  const existing = storage.getSupplies();
  if (existing.length > 0) {
    markMdiSuppliesSeeded();
    if (existing.some((s) => s.type === "cgm")) markStarterCgmSeeded();
    return { seeded: false, count: 0 };
  }

  const started = todayNoonIso();
  const insulinUnits = unitsForStarterPens(STARTER_MDI_PEN_COUNT);

  const rows: Omit<Supply, "id">[] = [
    starterCgmSupplyRow(),
    {
      name: "Pen Needles",
      type: "needle",
      currentQuantity: STARTER_NEEDLE_COUNT,
      dailyUsage: 0,
      lastPickupDate: started,
      quantityAtPickup: STARTER_NEEDLE_COUNT,
      notes: STARTER_SUPPLY_NOTE,
    },
    {
      name: "Short-Acting Insulin",
      type: "insulin_short",
      currentQuantity: insulinUnits,
      dailyUsage: 0,
      lastPickupDate: started,
      quantityAtPickup: insulinUnits,
      notes: STARTER_SUPPLY_NOTE,
    },
    {
      name: "Long-Acting Insulin",
      type: "insulin_long",
      currentQuantity: insulinUnits,
      dailyUsage: 0,
      lastPickupDate: started,
      quantityAtPickup: insulinUnits,
      notes: STARTER_SUPPLY_NOTE,
    },
  ];

  let count = 0;
  for (const row of rows) {
    storage.addSupply(row);
    count += 1;
  }

  markMdiSuppliesSeeded();
  markStarterCgmSeeded();
  return { seeded: true, count };
}

/**
 * Soft-add CGM for accounts that already have other supplies (e.g. older pump seed)
 * but never got a sensor row. Does not reappear after delete.
 */
export function ensureStarterCgmIfNeeded(): { seeded: boolean } {
  if (hasStarterCgmBeenSeeded()) return { seeded: false };

  const profile = storage.getProfile();
  if (
    !isPenDeliveryMethod(profile?.insulinDeliveryMethod) &&
    !isPumpDeliveryMethod(profile?.insulinDeliveryMethod)
  ) {
    return { seeded: false };
  }

  if (storage.getSupplies().some((s) => s.type === "cgm")) {
    markStarterCgmSeeded();
    return { seeded: false };
  }

  storage.addSupply(starterCgmSupplyRow());
  markStarterCgmSeeded();
  return { seeded: true };
}
