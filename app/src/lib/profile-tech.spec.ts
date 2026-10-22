import { describe, expect, it } from "vitest";
import {
  normalizeTechDelivery,
  normalizeTechSensor,
  publicTechChips,
  publicTechLine,
  suggestPublicTech,
} from "./profile-tech";

describe("normalizeTechSensor / normalizeTechDelivery", () => {
  it("accepts known values and rejects unknown ones", () => {
    expect(normalizeTechSensor(" Dexcom_G7 ")).toBe("dexcom_g7");
    expect(normalizeTechSensor("libre_3")).toBe("libre_3");
    expect(normalizeTechSensor("smartwatch")).toBeNull();
    expect(normalizeTechSensor(null)).toBeNull();
    expect(normalizeTechDelivery("omnipod")).toBe("omnipod");
    expect(normalizeTechDelivery("injections")).toBeNull();
  });
});

describe("publicTechChips", () => {
  it("stays empty until the member opts in", () => {
    expect(
      publicTechChips({ tech_sensor: "dexcom_g7", tech_delivery: "pens", show_tech_on_profile: false }),
    ).toEqual([]);
    expect(publicTechChips({ tech_sensor: "dexcom_g7", tech_delivery: "pens" })).toEqual([]);
    expect(publicTechChips(null)).toEqual([]);
  });

  it("labels sensor and delivery once opted in", () => {
    expect(
      publicTechChips({ tech_sensor: "dexcom_g7", tech_delivery: "pens", show_tech_on_profile: true }),
    ).toEqual(["Dexcom G7", "Insulin pens"]);
  });

  it("adds Closed loop to pump deliveries only", () => {
    expect(
      publicTechChips({
        tech_sensor: "libre_3",
        tech_delivery: "omnipod",
        tech_closed_loop: true,
        show_tech_on_profile: true,
      }),
    ).toEqual(["Libre 3", "Omnipod · Closed loop"]);
    expect(
      publicTechChips({
        tech_delivery: "pens",
        tech_closed_loop: true,
        show_tech_on_profile: true,
      }),
    ).toEqual(["Insulin pens"]);
  });

  it("drops unknown stored values", () => {
    expect(
      publicTechChips({ tech_sensor: "mystery", tech_delivery: "pens", show_tech_on_profile: true }),
    ).toEqual(["Insulin pens"]);
  });
});

describe("publicTechLine", () => {
  it("joins chips for compact lists", () => {
    expect(
      publicTechLine({ tech_sensor: "dexcom_g7", tech_delivery: "tandem", show_tech_on_profile: true }),
    ).toBe("Dexcom G7 · Tandem t:slim");
    expect(publicTechLine({ tech_sensor: "dexcom_g7", show_tech_on_profile: false })).toBeNull();
  });
});

describe("suggestPublicTech", () => {
  it("prefills from pen/pump and connected CGM family", () => {
    expect(suggestPublicTech({ insulinDeliveryMethod: "pen", cgmFamily: "dexcom" })).toEqual({
      tech_sensor: "dexcom",
      tech_delivery: "pens",
    });
    expect(suggestPublicTech({ insulinDeliveryMethod: "pump", cgmFamily: "libre" })).toEqual({
      tech_sensor: "libre",
      tech_delivery: "pump",
    });
    expect(suggestPublicTech({})).toEqual({ tech_sensor: null, tech_delivery: null });
  });
});
