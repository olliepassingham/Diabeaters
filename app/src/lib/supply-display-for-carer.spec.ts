import { describe, expect, it } from "vitest";
import type { CloudSupplyRow } from "@/lib/carers.types";
import { formatCarerSupplyQuantity } from "@/lib/supply-display-for-carer";

function row(partial: Partial<CloudSupplyRow> & Pick<CloudSupplyRow, "name" | "quantity">): CloudSupplyRow {
  return {
    id: "1",
    user_id: "u",
    name: partial.name,
    quantity: partial.quantity,
    updated_at: new Date().toISOString(),
    unit: null,
    category: partial.category ?? null,
    notes: null,
  };
}

describe("formatCarerSupplyQuantity", () => {
  it("formats insulin as pens using patient units per pen", () => {
    const s = row({ name: "Lantus Insulin", quantity: 5400, category: "insulin_long" });
    expect(formatCarerSupplyQuantity(s, { unitsPerInsulinPen: 100 })).toBe("54 pens");
  });

  it("formats needles as boxes using patient needles per box", () => {
    const s = row({ name: "Pen needles", quantity: 1000, category: "needle" });
    expect(formatCarerSupplyQuantity(s, { needlesPerBox: 100 })).toBe("10 boxes");
  });

  it("defaults to UK pack sizes when prefs missing", () => {
    const s = row({ name: "Novorapid", quantity: 2400, category: "insulin_short" });
    expect(formatCarerSupplyQuantity(s, null)).toBe("24 pens");
  });
});
