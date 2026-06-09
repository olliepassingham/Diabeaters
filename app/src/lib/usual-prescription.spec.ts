import { describe, expect, it } from "vitest";
import { getRepeatPrescriptionQuantity, supplyToUsualPrescriptionItem } from "@/lib/storage";
import { formatUsualItemQuantity } from "@/lib/usual-prescription";

describe("usual prescription helpers", () => {
  it("prefers typical refill quantity over stock levels", () => {
    const qty = getRepeatPrescriptionQuantity({
      id: "1",
      name: "NovoRapid",
      type: "insulin_short",
      currentQuantity: 120,
      dailyUsage: 30,
      typicalRefillQuantity: 1500,
      quantityAtPickup: 900,
    });
    expect(qty).toBe(1500);
  });

  it("falls back to quantity at pickup when no typical refill", () => {
    const qty = getRepeatPrescriptionQuantity({
      id: "1",
      name: "Needles",
      type: "needle",
      currentQuantity: 40,
      dailyUsage: 4,
      quantityAtPickup: 100,
    });
    expect(qty).toBe(100);
  });

  it("maps supply to usual prescription item", () => {
    const item = supplyToUsualPrescriptionItem({
      id: "1",
      name: "Dexcom G7",
      type: "cgm",
      currentQuantity: 2,
      dailyUsage: 0.14,
      typicalRefillQuantity: 3,
    });
    expect(item).toMatchObject({
      name: "Dexcom G7",
      type: "cgm",
      quantity: 3,
      dailyUsage: 0.14,
    });
  });

  it("formats pack-based quantities for display", () => {
    const formatted = formatUsualItemQuantity({
      name: "NovoRapid",
      type: "insulin_short",
      quantity: 1500,
      dailyUsage: 30,
    });
    expect(formatted.primary).toContain("pen");
    expect(formatted.secondary).toBe("1500 units");
  });
});
