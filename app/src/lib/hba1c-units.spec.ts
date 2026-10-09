import { describe, expect, it } from "vitest";
import {
  convertHba1cDraft,
  displayHba1cInput,
  formatHba1c,
  hba1cInputToPercent,
  mmolToPercent,
  percentToMmol,
  readHba1cUnit,
  writeHba1cUnit,
} from "./hba1c-units";

function clampPercent(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 3 || n > 20) return undefined;
  return Math.round(n * 10) / 10;
}

describe("HbA1c units", () => {
  it("converts between percent and mmol/mol", () => {
    expect(percentToMmol(7)).toBe(53);
    expect(mmolToPercent(53)).toBe(7);
    expect(percentToMmol(6.5)).toBe(48);
    expect(mmolToPercent(48)).toBe(6.5);
  });

  it("accepts a mmol/mol result and stores the percent", () => {
    expect(hba1cInputToPercent("53", "mmol", clampPercent)).toBe(7);
    expect(hba1cInputToPercent("7.2", "percent", clampPercent)).toBe(7.2);
    expect(hba1cInputToPercent("4", "mmol", clampPercent)).toBeUndefined();
  });

  it("formats and switches the draft with the chosen unit", () => {
    expect(formatHba1c(7, "mmol")).toBe("53 mmol/mol");
    expect(formatHba1c(7.2, "percent")).toBe("7.2%");
    expect(displayHba1cInput(7, "mmol")).toBe("53");
    expect(convertHba1cDraft("53", "mmol", "percent", clampPercent)).toBe("7");
  });

  it("remembers the last unit", () => {
    window.localStorage.removeItem("diabeaters_hba1c_unit_v1");
    expect(readHba1cUnit()).toBe("percent");
    writeHba1cUnit("mmol");
    expect(readHba1cUnit()).toBe("mmol");
    window.localStorage.removeItem("diabeaters_hba1c_unit_v1");
  });
});
