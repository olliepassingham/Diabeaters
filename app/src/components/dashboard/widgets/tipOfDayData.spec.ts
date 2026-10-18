import { describe, expect, it } from "vitest";

import { tipsForDelivery, tipsForProfile } from "./tipOfDayData";
import type { UserProfile } from "@/lib/storage";

const type2Profile = (): UserProfile => ({
  name: "Alex",
  email: "alex@example.com",
  dateOfBirth: "",
  bgUnits: "mmol/L",
  carbUnits: "grams",
  diabetesType: "type2",
  insulinDeliveryMethod: "",
  usingInsulin: false,
  hasAcceptedDisclaimer: true,
  accountType: "patient",
});

describe("tipsForDelivery", () => {
  it("hides injection and long-acting tips from pump users", () => {
    const text = tipsForDelivery("pump").map((tip) => tip.text).join("\n");
    expect(text).not.toMatch(/when injecting|injection sites|long-acting insulin timing/);
    expect(text).toMatch(/infusion sites/);
    expect(text).toMatch(/pump clock/);
    expect(text).toMatch(/backup pen/);
  });

  it("hides pump-only tips from pen users", () => {
    const text = tipsForDelivery("pen").map((tip) => tip.text).join("\n");
    expect(text).not.toMatch(/infusion sites|backup pen|pump clock/);
    expect(text).toMatch(/injection sites/);
    expect(text).toMatch(/long-acting insulin timing/);
  });
});

describe("tipsForProfile", () => {
  it("excludes insulin dosing tips for Type 2 and includes Type 2 audience tips", () => {
    const text = tipsForProfile(type2Profile()).map((tip) => tip.text).join("\n");
    expect(text).not.toMatch(/injection sites|underestimate your dose|never stop taking your basal|glucagon/);
    expect(text).toMatch(/Rename starter supplies/);
    expect(text).toMatch(/Type 2 diabetes/);
    expect(text).toMatch(/eye, foot, and blood-test/);
  });
});
