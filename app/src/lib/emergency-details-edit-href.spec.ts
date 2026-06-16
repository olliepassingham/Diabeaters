import { describe, expect, it } from "vitest";
import { emergencyDetailsEditHref } from "@/lib/emergency-details-edit-href";

describe("emergencyDetailsEditHref", () => {
  it("routes patients to account emergency section", () => {
    expect(emergencyDetailsEditHref(false)).toBe("/account#account-emergency");
  });

  it("routes supporters to carer-view emergency section", () => {
    expect(emergencyDetailsEditHref(true)).toBe("/carer-view#carer-emergency");
  });
});
