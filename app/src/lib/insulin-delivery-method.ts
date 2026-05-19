/**
 * Canonical checks for `UserProfile.insulinDeliveryMethod` / `profiles.insulin_delivery_method`.
 * Values are stored as lowercase `"pen"` | `"pump"`; these helpers accept common variants.
 */
export function isPumpDeliveryMethod(raw: string | null | undefined): boolean {
  return String(raw ?? "").trim().toLowerCase() === "pump";
}

export function isPenDeliveryMethod(raw: string | null | undefined): boolean {
  return String(raw ?? "").trim().toLowerCase() === "pen";
}
