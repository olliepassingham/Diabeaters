/** Total insulin units in one full disposable pen (not units/ml concentration). */
export const UK_DEFAULT_UNITS_PER_INSULIN_PEN = 300;

export const INSULIN_PEN_UNITS_PER_PEN_INFO_LINES = [
  "Enter the total units in one full pen — not the concentration on the label (e.g. 100 units/ml).",
  "Example: a 3 ml pen at 100 units/ml holds 300 units (100 × 3).",
  "Common totals: 300 (3 ml), 200 (2 ml), or 100 (1 ml).",
] as const;

export const INSULIN_STOCK_QUANTITY_HINT =
  "Enter your stock as total units. Example: two full 300-unit pens = 600. Check Settings → Usual Habits → Units per Insulin Pen matches your pen size.";
