/**
 * Structured "my diabetes tech" choices for the public community profile.
 * Stored on `profiles.tech_sensor` / `tech_delivery` (+ `tech_closed_loop`),
 * and only shown publicly when `show_tech_on_profile` is on.
 */

export type PublicTechProfileFields = {
  tech_sensor?: string | null;
  tech_delivery?: string | null;
  tech_closed_loop?: boolean | null;
  show_tech_on_profile?: boolean | null;
};

export type TechOption = { value: string; label: string };

export const TECH_SENSOR_OPTIONS: TechOption[] = [
  { value: "dexcom_g7", label: "Dexcom G7" },
  { value: "dexcom_g6", label: "Dexcom G6" },
  { value: "dexcom_one_plus", label: "Dexcom ONE+" },
  { value: "dexcom", label: "Dexcom" },
  { value: "libre_3", label: "Libre 3" },
  { value: "libre_2", label: "Libre 2" },
  { value: "libre", label: "Libre" },
  { value: "guardian", label: "Medtronic Guardian" },
  { value: "fingersticks", label: "Finger-prick testing" },
  { value: "other_sensor", label: "Other sensor" },
];

export const TECH_DELIVERY_OPTIONS: TechOption[] = [
  { value: "pens", label: "Insulin pens" },
  { value: "omnipod", label: "Omnipod" },
  { value: "tandem", label: "Tandem t:slim" },
  { value: "medtronic_pump", label: "Medtronic pump" },
  { value: "ypsopump", label: "YpsoPump" },
  { value: "pump", label: "Insulin pump" },
  { value: "other_pump", label: "Other pump" },
  { value: "tablets", label: "Tablets (no insulin)" },
  { value: "other_treatment", label: "Other treatment" },
];

/** Delivery values that can run a closed loop. */
const PUMP_DELIVERY_VALUES = new Set([
  "omnipod",
  "tandem",
  "medtronic_pump",
  "ypsopump",
  "pump",
  "other_pump",
]);

export function isPumpTechDelivery(value: string | null | undefined): boolean {
  return value != null && PUMP_DELIVERY_VALUES.has(value);
}

function labelFor(options: TechOption[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

export function normalizeTechSensor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return TECH_SENSOR_OPTIONS.some((o) => o.value === v) ? v : null;
}

export function normalizeTechDelivery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return TECH_DELIVERY_OPTIONS.some((o) => o.value === v) ? v : null;
}

/**
 * Public chips for a member's tech, e.g. ["Dexcom G7", "Omnipod · Closed loop"].
 * Empty unless the member opted in and picked at least one item.
 */
export function publicTechChips(profile: PublicTechProfileFields | null | undefined): string[] {
  if (!profile || profile.show_tech_on_profile !== true) return [];
  const chips: string[] = [];
  const sensor = labelFor(TECH_SENSOR_OPTIONS, normalizeTechSensor(profile.tech_sensor));
  if (sensor) chips.push(sensor);
  const deliveryValue = normalizeTechDelivery(profile.tech_delivery);
  const delivery = labelFor(TECH_DELIVERY_OPTIONS, deliveryValue);
  if (delivery) {
    chips.push(
      profile.tech_closed_loop === true && isPumpTechDelivery(deliveryValue)
        ? `${delivery} · Closed loop`
        : delivery,
    );
  }
  return chips;
}

/** One-line version for compact lists (Find people), e.g. "Dexcom G7 · Omnipod". */
export function publicTechLine(profile: PublicTechProfileFields | null | undefined): string | null {
  const chips = publicTechChips(profile);
  return chips.length > 0 ? chips.join(" · ") : null;
}

/**
 * Sensible starting values for the editor, from what the app already knows:
 * pen/pump delivery and a connected Dexcom/Libre CGM on this device.
 */
export function suggestPublicTech(input: {
  insulinDeliveryMethod?: string | null;
  cgmFamily?: "dexcom" | "libre" | null;
}): { tech_sensor: string | null; tech_delivery: string | null } {
  const method = String(input.insulinDeliveryMethod ?? "").trim().toLowerCase();
  return {
    tech_sensor:
      input.cgmFamily === "dexcom" ? "dexcom" : input.cgmFamily === "libre" ? "libre" : null,
    tech_delivery: method === "pen" ? "pens" : method === "pump" ? "pump" : null,
  };
}
