/** Whole units — typical pen / syringe increments. */
export const PEN_INSULIN_INCREMENT = 1;
/** Common pump bolus increment (0.05u). Planning aid only — devices vary. */
export const PUMP_INSULIN_INCREMENT = 0.05;

export function insulinRoundIncrement(isPump: boolean): number {
  return isPump ? PUMP_INSULIN_INCREMENT : PEN_INSULIN_INCREMENT;
}

/**
 * Round insulin to a delivery increment.
 * Pens default to whole units; pumps typically 0.05u.
 */
export function roundInsulinUnits(value: number, increment: number = PEN_INSULIN_INCREMENT): number {
  if (!Number.isFinite(value)) return 0;
  const step = increment > 0 && Number.isFinite(increment) ? increment : PEN_INSULIN_INCREMENT;
  const places = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(places));
}

/** Display helper so 5.10u reads as 5.1 and 5.00 as 5. */
export function formatInsulinUnits(value: number, increment: number = PEN_INSULIN_INCREMENT): string {
  const rounded = roundInsulinUnits(value, increment);
  if (increment >= 1) return String(rounded);
  return rounded.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
