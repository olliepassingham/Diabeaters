import { describe, expect, it } from "vitest";
import {
  formatPublicDiabetesMetaLine,
  formatPublicDiabetesTypeLabel,
} from "@/lib/profile";

describe("formatPublicDiabetesTypeLabel", () => {
  it("labels type1 and type2", () => {
    expect(formatPublicDiabetesTypeLabel("type1")).toBe("Type 1");
    expect(formatPublicDiabetesTypeLabel("type2")).toBe("Type 2");
  });

  it("hides non-public types", () => {
    expect(formatPublicDiabetesTypeLabel("none")).toBeNull();
    expect(formatPublicDiabetesTypeLabel("gestational")).toBeNull();
    expect(formatPublicDiabetesTypeLabel(null)).toBeNull();
  });
});

describe("formatPublicDiabetesMetaLine", () => {
  it("returns type alone", () => {
    expect(formatPublicDiabetesMetaLine({ diabetesType: "type2" })).toBe("Type 2");
  });

  it("combines type and tenure", () => {
    const onset = "2018-06-15";
    const line = formatPublicDiabetesMetaLine({ diabetesType: "type1", diabetesOnsetDate: onset });
    expect(line).toMatch(/^Type 1 · Living with diabetes/);
  });

  it("returns tenure alone when type missing", () => {
    const line = formatPublicDiabetesMetaLine({ diabetesOnsetDate: "2020-01-01" });
    expect(line).toMatch(/^Living with diabetes/);
  });
});
