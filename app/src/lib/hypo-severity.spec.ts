import { describe, expect, it } from "vitest";
import { classifyHypoSeverity } from "./hypo-severity";

describe("classifyHypoSeverity", () => {
  it("classifies mmol/L bands", () => {
    expect(classifyHypoSeverity(2.5, "mmol/L")?.band).toBe("severe");
    expect(classifyHypoSeverity(3.0, "mmol/L")?.band).toBe("moderate");
    expect(classifyHypoSeverity(3.7, "mmol/L")?.band).toBe("mild");
    expect(classifyHypoSeverity(5.0, "mmol/L")).toBeNull();
  });

  it("classifies mg/dL using the same mmol thresholds", () => {
    expect(classifyHypoSeverity(45, "mg/dL")?.band).toBe("severe");
    expect(classifyHypoSeverity(54, "mg/dL")?.band).toBe("moderate");
    expect(classifyHypoSeverity(67, "mg/dL")?.band).toBe("mild");
    expect(classifyHypoSeverity(90, "mg/dL")).toBeNull();
  });
});
