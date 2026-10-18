import { beforeEach, describe, expect, it } from "vitest";
import { clearOnboardingAccountPath, setOnboardingAccountPath } from "@/lib/carer-session";
import {
  hasInsulinClinicalTools,
  isInsulinClinicalPath,
  isType2AppSession,
  isType2HiddenToolsPath,
  isType2Patient,
} from "@/lib/insulin-clinical-access";

describe("insulin-clinical-access", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOnboardingAccountPath();
  });

  it("detects Type 2 patients", () => {
    expect(isType2Patient({ diabetesType: "type2", usingInsulin: false, accountType: "patient" })).toBe(
      true,
    );
    expect(isType2Patient({ diabetesType: "type1", usingInsulin: true, accountType: "patient" })).toBe(
      false,
    );
  });

  it("treats onboarding path type2 as a Type 2 session", () => {
    expect(isType2AppSession({ diabetesType: "type1", usingInsulin: true, accountType: "patient" })).toBe(
      false,
    );
    setOnboardingAccountPath("type2");
    expect(isType2AppSession({ diabetesType: "type1", usingInsulin: true, accountType: "patient" })).toBe(
      true,
    );
  });

  it("hides insulin clinical tools for Type 2 and community", () => {
    expect(
      hasInsulinClinicalTools({ diabetesType: "type2", usingInsulin: false, accountType: "patient" }),
    ).toBe(false);
    expect(
      hasInsulinClinicalTools({ diabetesType: "none", usingInsulin: false, accountType: "community" }),
    ).toBe(false);
    expect(
      hasInsulinClinicalTools({ diabetesType: "type1", usingInsulin: true, accountType: "patient" }),
    ).toBe(true);
  });

  it("recognises insulin clinical paths", () => {
    expect(isInsulinClinicalPath("/adviser?tab=meal")).toBe(true);
    expect(isInsulinClinicalPath("/scenarios/exercise")).toBe(true);
    expect(isInsulinClinicalPath("/scenarios/alcohol")).toBe(true);
    expect(isInsulinClinicalPath("/tools")).toBe(false);
    expect(isInsulinClinicalPath("/community")).toBe(false);
  });

  it("allows supplies for Type 2 but blocks for Type 1 clinical gate", () => {
    expect(
      isInsulinClinicalPath("/supplies", {
        diabetesType: "type2",
        usingInsulin: false,
        accountType: "patient",
      }),
    ).toBe(false);
    expect(
      isInsulinClinicalPath("/supplies", {
        diabetesType: "type1",
        usingInsulin: true,
        accountType: "patient",
      }),
    ).toBe(true);
  });

  it("hides Type 1 achievement and activity paths from Type 2", () => {
    expect(isType2HiddenToolsPath("/tools/achievements")).toBe(true);
    expect(isType2HiddenToolsPath("/tools/activity")).toBe(true);
    expect(isType2HiddenToolsPath("/tools/hypo-help")).toBe(false);
    expect(isType2HiddenToolsPath("/tools")).toBe(false);
  });
});
