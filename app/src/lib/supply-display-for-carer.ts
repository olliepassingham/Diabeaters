import type { CloudSupplyRow } from "@/lib/carers.types";
import {
  getSupplyIncrement,
  getUnitsPerPen,
  type SupplyType,
  type UserSettings,
  UK_DEFAULT_NEEDLES_PER_BOX,
  UK_DEFAULT_UNITS_PER_INSULIN_PEN,
} from "@/lib/storage";

export type PatientSupplyPackPrefs = {
  unitsPerInsulinPen?: number | null;
  needlesPerBox?: number | null;
};

const INSULIN_TYPES: SupplyType[] = ["insulin", "insulin_short", "insulin_long"];

function settingsFromPackPrefs(prefs?: PatientSupplyPackPrefs | null): UserSettings {
  return {
    unitsPerInsulinPen:
      prefs?.unitsPerInsulinPen != null && prefs.unitsPerInsulinPen > 0
        ? prefs.unitsPerInsulinPen
        : UK_DEFAULT_UNITS_PER_INSULIN_PEN,
    needlesPerBox:
      prefs?.needlesPerBox != null && prefs.needlesPerBox > 0
        ? prefs.needlesPerBox
        : UK_DEFAULT_NEEDLES_PER_BOX,
  };
}

function cloudCategoryToSupplyType(category: string | null | undefined): SupplyType | null {
  if (!category?.trim()) return null;
  const c = category.trim() as SupplyType;
  if (c === "insulin" || c === "insulin_short" || c === "insulin_long" || c === "insulin_vial") return c;
  if (c === "needle" || c === "cgm" || c === "infusion_set" || c === "reservoir" || c === "other") return c;
  return null;
}

/** Infer type when cloud `category` is missing (legacy rows). */
export function inferSupplyTypeFromCloudRow(row: Pick<CloudSupplyRow, "name" | "category">): SupplyType {
  const fromCat = cloudCategoryToSupplyType(row.category);
  if (fromCat) return fromCat;
  const n = row.name.toLowerCase();
  if (n.includes("needle")) return "needle";
  if (n.includes("dexcom") || n.includes("libre") || n.includes("cgm") || n.includes("sensor")) return "cgm";
  if (n.includes("infusion") || n.includes("set")) return "infusion_set";
  if (n.includes("reservoir") || (n.includes("cartridge") && n.includes("pump"))) return "reservoir";
  if (n.includes("insulin") || n.includes("novorapid") || n.includes("lantus") || n.includes("humalog")) {
    return "insulin_short";
  }
  return "other";
}

function pluralize(label: string, count: number): string {
  if (count === 1) return label;
  if (label === "box") return "boxes";
  if (label === "pen") return "pens";
  if (label === "sensor") return "sensors";
  if (label === "vial") return "vials";
  if (label === "set") return "sets";
  return `${label}s`;
}

/**
 * Format cloud stock quantity for supporter read-only view (pens, boxes, sensors).
 */
export function formatCarerSupplyQuantity(
  row: CloudSupplyRow,
  packPrefs?: PatientSupplyPackPrefs | null,
): string {
  const qty = Math.max(0, Math.round(Number(row.quantity)));
  if (!Number.isFinite(qty)) return "—";

  const settings = settingsFromPackPrefs(packPrefs);
  const type = inferSupplyTypeFromCloudRow(row);

  if (INSULIN_TYPES.includes(type)) {
    const perPen = getUnitsPerPen(settings);
    const pens = Math.floor(qty / perPen);
    return `${pens} ${pluralize("pen", pens)}`;
  }

  if (type === "insulin_vial") {
    const inc = getSupplyIncrement(type, settings);
    const vials = Math.floor(qty / inc.amount);
    return `${vials} ${pluralize(inc.label, vials)}`;
  }

  if (type === "needle") {
    const perBox = Math.max(1, settings.needlesPerBox || UK_DEFAULT_NEEDLES_PER_BOX);
    const boxes = Math.floor(qty / perBox);
    return `${boxes} ${pluralize("box", boxes)}`;
  }

  if (type === "cgm") {
    return `${qty} ${pluralize("sensor", qty)}`;
  }

  const inc = getSupplyIncrement(type, settings);
  if (inc.amount > 1 && (inc.label === "box" || inc.label === "set")) {
    const packs = Math.floor(qty / inc.amount);
    return `${packs} ${pluralize(inc.label, packs)}`;
  }

  return String(qty);
}

/** Format event delta for supporter recent changes (e.g. +1 pen, +100 units stays as units if unknown type). */
export function formatCarerSupplyEventDelta(
  delta: number,
  row: CloudSupplyRow,
  packPrefs?: PatientSupplyPackPrefs | null,
): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return "0";
  const sign = rounded > 0 ? "+" : "";
  const settings = settingsFromPackPrefs(packPrefs);
  const type = inferSupplyTypeFromCloudRow(row);

  if (INSULIN_TYPES.includes(type)) {
    const perPen = getUnitsPerPen(settings);
    const pens = Math.round((rounded / perPen) * 10) / 10;
    if (Math.abs(pens) >= 0.05 && Math.abs(pens - Math.round(pens)) < 0.05) {
      const whole = Math.round(pens);
      return `${sign}${whole} ${pluralize("pen", Math.abs(whole))}`;
    }
  }

  if (type === "needle") {
    const perBox = Math.max(1, settings.needlesPerBox || UK_DEFAULT_NEEDLES_PER_BOX);
    const boxes = Math.round((rounded / perBox) * 10) / 10;
    if (Math.abs(boxes) >= 0.05 && Math.abs(boxes - Math.round(boxes)) < 0.05) {
      const whole = Math.round(boxes);
      return `${sign}${whole} ${pluralize("box", Math.abs(whole))}`;
    }
  }

  return `${sign}${rounded}`;
}
