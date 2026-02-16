import type { RatioFormat } from "./storage";

export function parseRatioToGramsPerUnit(ratioStr?: string): number | null {
  if (!ratioStr) return null;
  const trimmed = ratioStr.trim();

  const matchOneToX = trimmed.match(/^1\s*:\s*(\d+(?:\.\d+)?)g?$/);
  if (matchOneToX) {
    return parseFloat(matchOneToX[1]);
  }

  const numVal = parseFloat(trimmed);
  if (!isNaN(numVal) && numVal > 0) {
    if (numVal >= 3) {
      return numVal;
    }
    return 10 / numVal;
  }

  return null;
}

export function formatRatioForDisplay(gramsPerUnit: number, format: RatioFormat): string {
  if (format === "1toXg") {
    const rounded = Math.round(gramsPerUnit * 10) / 10;
    return `1:${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}g`;
  }
  const unitsPer10g = 10 / gramsPerUnit;
  const rounded = Math.round(unitsPer10g * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}u per 10g`;
}

export function formatRatioForStorage(gramsPerUnit: number): string {
  const rounded = Math.round(gramsPerUnit * 10) / 10;
  return `1:${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

export function formatRatioInputPlaceholder(format: RatioFormat): string {
  if (format === "1toXg") return "e.g., 10";
  return "e.g., 1.0";
}

export function formatRatioInputLabel(format: RatioFormat): string {
  if (format === "1toXg") return "grams per 1 unit";
  return "units per 10g";
}

export function parseInputToGramsPerUnit(inputValue: string, format: RatioFormat): number | null {
  const num = parseFloat(inputValue);
  if (isNaN(num) || num <= 0) return null;

  if (format === "1toXg") {
    return num;
  }
  return 10 / num;
}

export function gramsPerUnitToInputValue(gramsPerUnit: number, format: RatioFormat): string {
  if (format === "1toXg") {
    const rounded = Math.round(gramsPerUnit * 10) / 10;
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  }
  const unitsPer10g = 10 / gramsPerUnit;
  const rounded = Math.round(unitsPer10g * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

export function calculateDoseFromCarbs(carbs: number, ratioStr?: string): number {
  const gramsPerUnit = parseRatioToGramsPerUnit(ratioStr);
  if (!gramsPerUnit || gramsPerUnit <= 0) return 0;
  return carbs / gramsPerUnit;
}
