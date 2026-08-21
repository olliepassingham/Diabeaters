import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { getEffectiveTdd } from "@/lib/tdd";
import {
  markStarterCgmSeeded,
  starterCgmSupplyRow,
  STARTER_SUPPLY_NOTE,
} from "@/lib/starter-supply-shared";
import { storage, type Supply } from "@/lib/storage";

export const PUMP_SUPPLIES_SEEDED_KEY = "diabeaters_pump_supplies_seeded_v1";

export type PumpSupplySeedOptions = {
  tdd?: number;
  siteChangeDays?: number;
  reservoirChangeDays?: number;
  reservoirCapacity?: number;
};

function todayNoonIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function hasPumpSupplyTypes(): boolean {
  return storage.getSupplies().some(
    (s) => s.type === "infusion_set" || s.type === "reservoir" || s.type === "insulin_vial",
  );
}

/** True when starter rows have not been added yet for this device. */
export function shouldSeedPumpSupplies(): boolean {
  try {
    return localStorage.getItem(PUMP_SUPPLIES_SEEDED_KEY) !== "1";
  } catch {
    return true;
  }
}

function markPumpSuppliesSeeded(): void {
  try {
    localStorage.setItem(PUMP_SUPPLIES_SEEDED_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Add default pump supply rows once (CGM, infusion sets, reservoirs, insulin, backup pens).
 * Safe to call multiple times — no-ops when already seeded or pump types exist.
 */
export function seedPumpSuppliesIfNeeded(opts: PumpSupplySeedOptions = {}): { seeded: boolean; count: number } {
  if (!shouldSeedPumpSupplies()) return { seeded: false, count: 0 };
  if (hasPumpSupplyTypes()) {
    markPumpSuppliesSeeded();
    if (storage.getSupplies().some((s) => s.type === "cgm")) markStarterCgmSeeded();
    return { seeded: false, count: 0 };
  }

  const profile = storage.getProfile();
  if (!isPumpDeliveryMethod(profile?.insulinDeliveryMethod)) {
    return { seeded: false, count: 0 };
  }

  const tdd = opts.tdd && opts.tdd > 0 ? opts.tdd : getEffectiveTdd(storage.getSettings()) ?? 40;
  const started = todayNoonIso();
  const backupNote = "Backup for pump failure — confirm doses with your diabetes team.";

  const rows: Omit<Supply, "id">[] = [
    starterCgmSupplyRow(),
    {
      name: "Infusion Sets",
      type: "infusion_set",
      currentQuantity: 10,
      dailyUsage: 0,
      activeItemStartDate: started,
      notes: STARTER_SUPPLY_NOTE,
    },
    {
      name: "Reservoirs / Cartridges",
      type: "reservoir",
      currentQuantity: 10,
      dailyUsage: 0,
      activeItemStartDate: started,
      notes: STARTER_SUPPLY_NOTE,
    },
    {
      name: "Pump Insulin (vial/cartridge)",
      type: "insulin_vial",
      currentQuantity: 3,
      dailyUsage: tdd,
      lastPickupDate: started,
      quantityAtPickup: 3,
      notes: STARTER_SUPPLY_NOTE,
    },
    {
      name: "Backup Rapid-Acting Pen",
      type: "insulin_short",
      currentQuantity: 100,
      dailyUsage: 0,
      notes: backupNote,
    },
    {
      name: "Backup Long-Acting Pen",
      type: "insulin_long",
      currentQuantity: 100,
      dailyUsage: 0,
      notes: backupNote,
    },
    {
      name: "Backup Pen Needles",
      type: "needle",
      currentQuantity: 30,
      dailyUsage: 0,
      notes: "For backup pens if your pump fails.",
    },
  ];

  let count = 0;
  for (const row of rows) {
    storage.addSupply(row);
    count += 1;
  }

  const settingsPatch: Record<string, number> = {};
  if (opts.siteChangeDays && opts.siteChangeDays > 0) settingsPatch.siteChangeDays = opts.siteChangeDays;
  if (opts.reservoirChangeDays && opts.reservoirChangeDays > 0) {
    settingsPatch.reservoirChangeDays = opts.reservoirChangeDays;
  }
  if (opts.reservoirCapacity && opts.reservoirCapacity > 0) {
    settingsPatch.reservoirCapacity = opts.reservoirCapacity;
  }
  if (Object.keys(settingsPatch).length > 0) {
    storage.saveSettings({ ...storage.getSettings(), ...settingsPatch });
  }

  markPumpSuppliesSeeded();
  markStarterCgmSeeded();
  return { seeded: true, count };
}

export function pumpSetupCompletion(profile: ReturnType<typeof storage.getProfile>, supplies: Supply[]): {
  siteInterval: boolean;
  reservoirCapacity: boolean;
  tracksSets: boolean;
  tracksReservoirs: boolean;
  tracksBackup: boolean;
} {
  const settings = storage.getSettings();
  const isPump = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  if (!isPump) {
    return {
      siteInterval: true,
      reservoirCapacity: true,
      tracksSets: true,
      tracksReservoirs: true,
      tracksBackup: true,
    };
  }
  const hasShort = supplies.some((s) => s.type === "insulin_short");
  const hasLong = supplies.some((s) => s.type === "insulin_long");
  return {
    siteInterval: (settings.siteChangeDays ?? 0) > 0,
    reservoirCapacity: (settings.reservoirCapacity ?? 0) > 0,
    tracksSets: supplies.some((s) => s.type === "infusion_set"),
    tracksReservoirs: supplies.some((s) => s.type === "reservoir"),
    tracksBackup: hasShort && hasLong,
  };
}
