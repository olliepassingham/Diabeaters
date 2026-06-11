import { describe, expect, it } from "vitest";

import {
  assessPumpFailureEscalation,
  bgLevelMgDl,
  parsePumpFailureBgInput,
  telHrefForPhone,
} from "@/lib/pump-failure-guide";

describe("pump-failure-guide", () => {
  it("parsePumpFailureBgInput accepts decimals", () => {
    expect(parsePumpFailureBgInput("14,2")).toBe(14.2);
    expect(parsePumpFailureBgInput("")).toBeNull();
    expect(parsePumpFailureBgInput("-1")).toBeNull();
  });

  it("bgLevelMgDl converts mmol/L to mg/dL", () => {
    expect(bgLevelMgDl(14, "mmol/L")).toBe(252);
    expect(bgLevelMgDl(250, "mg/dL")).toBe(250);
  });

  it("assessPumpFailureEscalation treats large ketones as emergency", () => {
    const r = assessPumpFailureEscalation({
      ketonesLevel: "large",
      region: "UK",
    });
    expect(r.level).toBe("emergency");
    expect(r.message).toContain("999");
  });

  it("assessPumpFailureEscalation escalates vomiting to emergency", () => {
    const r = assessPumpFailureEscalation({
      ketonesLevel: "unknown",
      symptoms: { vomiting: true },
      region: "UK",
    });
    expect(r.level).toBe("emergency");
  });

  it("assessPumpFailureEscalation flags moderate ketones with high bg", () => {
    const r = assessPumpFailureEscalation({
      ketonesLevel: "moderate",
      bgValue: 15,
      bgUnits: "mmol/L",
      region: "US",
    });
    expect(r.level).toBe("emergency");
    expect(r.message).toContain("911");
  });

  it("telHrefForPhone builds tel links for valid numbers", () => {
    expect(telHrefForPhone("07123 456789")).toBe("tel:07123456789");
    expect(telHrefForPhone("abc")).toBeNull();
  });
});
