export type Hba1cUnit = "percent" | "mmol";

const STORAGE_KEY = "diabeaters_hba1c_unit_v1";
const CHANGE_EVENT = "diabeaters-hba1c-unit";

/** IFCC: mmol/mol = 10.929 × (% − 2.15). */
const MMOL_FACTOR = 10.929;
const MMOL_OFFSET = 2.15;

export function isHba1cUnit(value: unknown): value is Hba1cUnit {
  return value === "percent" || value === "mmol";
}

export function readHba1cUnit(): Hba1cUnit {
  if (typeof window === "undefined") return "percent";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isHba1cUnit(raw) ? raw : "percent";
  } catch {
    return "percent";
  }
}

export function writeHba1cUnit(unit: Hba1cUnit) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // The choice still applies for this screen.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeHba1cUnit(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => onChange();
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function percentToMmol(percent: number): number {
  return Math.round((percent - MMOL_OFFSET) * MMOL_FACTOR);
}

export function mmolToPercent(mmol: number): number {
  return Math.round((mmol / MMOL_FACTOR + MMOL_OFFSET) * 10) / 10;
}

/** mmol/mol that still fits the stored 3–20% range. */
export function clampHba1cMmolInput(raw: string): number | undefined {
  const t = raw.trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  if (rounded < 9 || rounded > 195) return undefined;
  return rounded;
}

export function hba1cInputToPercent(raw: string, unit: Hba1cUnit, clampPercent: (raw: string) => number | undefined): number | undefined {
  if (unit === "percent") return clampPercent(raw);
  const mmol = clampHba1cMmolInput(raw);
  if (mmol == null) return undefined;
  const percent = mmolToPercent(mmol);
  return clampPercent(String(percent));
}

export function displayHba1cInput(percent: number, unit: Hba1cUnit): string {
  return unit === "mmol" ? String(percentToMmol(percent)) : String(Math.round(percent * 10) / 10);
}

export function convertHba1cDraft(
  raw: string,
  from: Hba1cUnit,
  to: Hba1cUnit,
  clampPercent: (raw: string) => number | undefined,
): string {
  if (from === to || !raw.trim()) return raw;
  const percent = hba1cInputToPercent(raw, from, clampPercent);
  if (percent == null) return "";
  return displayHba1cInput(percent, to);
}

export function formatHba1c(percent: number, unit: Hba1cUnit): string {
  if (unit === "mmol") return `${percentToMmol(percent)} mmol/mol`;
  return `${Math.round(percent * 10) / 10}%`;
}

export function hba1cUnitLabel(unit: Hba1cUnit): string {
  return unit === "mmol" ? "mmol/mol" : "%";
}

export function hba1cChartValue(percent: number, unit: Hba1cUnit): number {
  return unit === "mmol" ? percentToMmol(percent) : Math.round(percent * 10) / 10;
}
