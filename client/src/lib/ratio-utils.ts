import type { RatioFormat } from "./storage";

const DEFAULT_CP_SIZE = 10;

export function getCarbPortionSize(cpSize?: number): number {
  return cpSize && cpSize > 0 ? cpSize : DEFAULT_CP_SIZE;
}

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

export function formatRatioForDisplay(gramsPerUnit: number, format: RatioFormat, cpSize?: number): string {
  if (format === "1toXg") {
    const rounded = Math.round(gramsPerUnit * 10) / 10;
    return `1:${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}g`;
  }
  if (format === "perCP") {
    const portionSize = getCarbPortionSize(cpSize);
    const unitsPerCP = portionSize / gramsPerUnit;
    const rounded = Math.round(unitsPerCP * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}u per 1 CP`;
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
  if (format === "perCP") return "e.g., 1.0";
  return "e.g., 1.0";
}

export function formatRatioInputLabel(format: RatioFormat, cpSize?: number): string {
  if (format === "1toXg") return "grams per 1 unit";
  if (format === "perCP") {
    const portionSize = getCarbPortionSize(cpSize);
    return `units per 1 CP (${portionSize}g)`;
  }
  return "units per 10g";
}

export function parseInputToGramsPerUnit(inputValue: string, format: RatioFormat, cpSize?: number): number | null {
  const num = parseFloat(inputValue);
  if (isNaN(num) || num <= 0) return null;

  if (format === "1toXg") {
    return num;
  }
  if (format === "perCP") {
    const portionSize = getCarbPortionSize(cpSize);
    return portionSize / num;
  }
  return 10 / num;
}

export function gramsPerUnitToInputValue(gramsPerUnit: number, format: RatioFormat, cpSize?: number): string {
  if (format === "1toXg") {
    const rounded = Math.round(gramsPerUnit * 10) / 10;
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  }
  if (format === "perCP") {
    const portionSize = getCarbPortionSize(cpSize);
    const unitsPerCP = portionSize / gramsPerUnit;
    const rounded = Math.round(unitsPerCP * 10) / 10;
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
