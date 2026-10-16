import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { getEffectiveTdd } from "@/lib/tdd";
import {
  markStarterCgmSeeded,
  starterCgmSupplyRow,
  STARTER_SUPPLY_NOTE,
} from "@/lib/starter-supply-shared";
import { getSupplyIncrement, storage, type Supply } from "@/lib/storage";

export const PUMP_SUPPLIES_SEEDED_KEY = "diabeaters_pump_supplies_seeded_v1";

/** Example backup rows from older starter seeds — removed on normalize. */
const EXAMPLE_BACKUP_SUPPLY_NAMES = [
  "Backup Rapid-Acting Pen",
  "Backup Long-Acting Pen",
  "Backup Pen Needles",
] as const;

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

function resolveTdd(opts: PumpSupplySeedOptions): number {
  return opts.tdd && opts.tdd > 0 ? opts.tdd : getEffectiveTdd(storage.getSettings()) ?? 40;
}

/** Example stock: one 1000u vial/cartridge so runway stays healthy (not critical). */
function starterPumpInsulinUnits(): number {
  return 1000;
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

function queueCloudDelete(local: Supply): void {
  void import("@/lib/supplies").then((m) => void m.deleteFromCloud(local));
}

function queueCloudSync(localId: string): void {
  void import("@/lib/supplies").then((m) => {
    const local = storage.getSupplies().find((s) => s.id === localId);
    if (local) void m.syncToCloud(local);
  });
}

/**
 * Clean up older example pump seeds: drop backup pens/needles and bump starter
 * pump insulin stock so it isn't flagged critical.
 */
export function normalizeExamplePumpSupplies(opts: PumpSupplySeedOptions = {}): void {
  const profile = storage.getProfile();
  if (!isPumpDeliveryMethod(profile?.insulinDeliveryMethod)) return;

  const backupNames = new Set(EXAMPLE_BACKUP_SUPPLY_NAMES.map((n) => n.toLowerCase()));
  const tdd = resolveTdd(opts);
  const healthyQty = starterPumpInsulinUnits();

  for (const s of [...storage.getSupplies()]) {
    if (backupNames.has(s.name.toLowerCase().trim())) {
      storage.deleteSupply(s.id);
      queueCloudDelete(s);
      continue;
    }

    const isStarterPumpInsulin =
      s.type === "insulin_vial" &&
      (s.notes === STARTER_SUPPLY_NOTE || /^pump insulin/i.test(s.name.trim()));
    if (!isStarterPumpInsulin) continue;

    const qtyPatch =
      s.currentQuantity < 100
        ? {
            currentQuantity: healthyQty,
            quantityAtPickup: healthyQty,
            lastPickupDate: todayNoonIso(),
          }
        : {};
    if (s.dailyUsage === tdd && Object.keys(qtyPatch).length === 0) continue;

    const updated = storage.updateSupply(s.id, {
      dailyUsage: tdd,
      ...qtyPatch,
    });
    if (updated) queueCloudSync(updated.id);
  }
}

/**
 * Add default pump supply rows once (CGM, infusion sets, reservoirs, insulin).
 * Safe to call multiple times — no-ops when pump types already exist.
 * Once this device has seeded them, deleting the set does not bring them back.
 */
export function seedPumpSuppliesIfNeeded(opts: PumpSupplySeedOptions = {}): { seeded: boolean; count: number } {
  normalizeExamplePumpSupplies(opts);

  if (!shouldSeedPumpSupplies()) {
    return { seeded: false, count: 0 };
  }

  if (hasPumpSupplyTypes()) {
    markPumpSuppliesSeeded();
    if (storage.getSupplies().some((s) => s.type === "cgm")) markStarterCgmSeeded();
    return { seeded: false, count: 0 };
  }

  const profile = storage.getProfile();
  if (!isPumpDeliveryMethod(profile?.insulinDeliveryMethod)) {
    return { seeded: false, count: 0 };
  }

  const tdd = resolveTdd(opts);
  const started = todayNoonIso();
  const insulinUnits = starterPumpInsulinUnits();

  const existing = storage.getSupplies();
  const hasCgm = existing.some((s) => s.type === "cgm");

  const rows: Omit<Supply, "id">[] = [
    ...(hasCgm ? [] : [starterCgmSupplyRow()]),
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
      currentQuantity: insulinUnits,
      dailyUsage: tdd,
      lastPickupDate: started,
      quantityAtPickup: insulinUnits,
      notes: STARTER_SUPPLY_NOTE,
    },
  ];

  let count = 0;
  for (const row of rows) {
    const current = storage.getSupplies();
    const nameTaken = current.some(
      (s) => s.name.toLowerCase().trim() === row.name.toLowerCase().trim(),
    );
    const uniqueTypeTaken =
      (row.type === "infusion_set" ||
        row.type === "reservoir" ||
        row.type === "insulin_vial" ||
        row.type === "cgm") &&
      current.some((s) => s.type === row.type);
    if (nameTaken || uniqueTypeTaken) continue;
    storage.addSupply(row);
    count += 1;
  }

  if (count === 0) {
    markPumpSuppliesSeeded();
    if (storage.getSupplies().some((s) => s.type === "cgm")) markStarterCgmSeeded();
    return { seeded: false, count: 0 };
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

export type PumpCareKind = "infusion_set" | "reservoir";

export type PumpCareItem = {
  id: string;
  kind: PumpCareKind;
  /** Days until the next change; 0 = due or overdue. Null when no active start date. */
  daysLeft: number | null;
  dueToday: boolean;
  changeButtonLabel: string;
  dueCaption: string;
};

export type PumpCareSnapshot = {
  setupIncomplete: boolean;
  set: PumpCareItem | null;
  reservoir: PumpCareItem | null;
  /** Prefer infusion set when both are due. */
  dueSoonKind: PumpCareKind | null;
  stockLine: string | null;
};

function formatPumpStockLine(
  supplies: Supply[],
  getAdjustedQuantity: (s: Supply) => number,
  getIncrement: (type: Supply["type"]) => { amount: number; label: string },
): string | null {
  const parts: string[] = [];
  for (const kind of ["infusion_set", "reservoir"] as const) {
    const row = supplies.find((s) => s.type === kind);
    if (!row) continue;
    const qty = Math.max(0, Math.floor(getAdjustedQuantity(row)));
    const { amount, label } = getIncrement(kind);
    const noun = kind === "infusion_set" ? "sets" : "reservoirs";
    if (amount > 1) {
      const boxes = Math.floor(qty / amount);
      if (boxes > 0) {
        parts.push(`${boxes} ${label}${boxes === 1 ? "" : "es"} of ${noun}`);
        continue;
      }
    }
    parts.push(`${qty} ${noun}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function toPumpCareItem(
  supply: Supply,
  kind: PumpCareKind,
  info: { daysLeft: number; isExpired: boolean } | null,
): PumpCareItem {
  const daysLeft = info ? Math.max(0, info.daysLeft) : null;
  const dueToday = daysLeft != null && daysLeft <= 1;
  const changeButtonLabel =
    kind === "infusion_set"
      ? dueToday
        ? "Changed set"
        : "Changed early"
      : dueToday
        ? "Changed reservoir"
        : "Changed early";
  const dueCaption =
    daysLeft == null
      ? "Set a start date in Supply Tracker"
      : dueToday
        ? "Change due today"
        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  return {
    id: supply.id,
    kind,
    daysLeft,
    dueToday,
    changeButtonLabel,
    dueCaption,
  };
}

/**
 * Home pump-care strip model: set/reservoir due, stock line, and whether setup is missing.
 * Pure against injected readers so unit tests do not need a full storage mock.
 */
export function getPumpCareSnapshot(
  supplies: Supply[],
  readers: {
    getActiveItemInfo: (supply: Supply) => { daysLeft: number; isExpired: boolean } | null;
    getAdjustedQuantity: (supply: Supply) => number;
    getSupplyIncrement: (type: Supply["type"]) => { amount: number; label: string };
  } = {
    getActiveItemInfo: (s) => storage.getActiveItemInfo(s),
    getAdjustedQuantity: (s) => storage.getAdjustedQuantity(s),
    getSupplyIncrement: (type) => getSupplyIncrement(type),
  },
): PumpCareSnapshot {
  const setRow = supplies.find((s) => s.type === "infusion_set") ?? null;
  const reservoirRow = supplies.find((s) => s.type === "reservoir") ?? null;
  const setupIncomplete = !setRow && !reservoirRow;

  const set = setRow
    ? toPumpCareItem(setRow, "infusion_set", readers.getActiveItemInfo(setRow))
    : null;
  const reservoir = reservoirRow
    ? toPumpCareItem(reservoirRow, "reservoir", readers.getActiveItemInfo(reservoirRow))
    : null;

  let dueSoonKind: PumpCareKind | null = null;
  if (set?.dueToday) dueSoonKind = "infusion_set";
  else if (reservoir?.dueToday) dueSoonKind = "reservoir";

  return {
    setupIncomplete,
    set,
    reservoir,
    dueSoonKind,
    stockLine: setupIncomplete
      ? null
      : formatPumpStockLine(supplies, readers.getAdjustedQuantity, readers.getSupplyIncrement),
  };
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
