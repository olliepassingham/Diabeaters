import { describe, expect, it } from "vitest";

import { getMedicalSourcesSections, medicalSourcesPageDescription } from "@/lib/medical-sources-content";
import {
  getKetoneEmergencyCopy,
  getKetoneEmergencyCopyForProfile,
  getRegionEmergencyFooter,
  travelEnglishEmergencyNumber,
} from "@/lib/region";
import type { UserProfile } from "@/lib/storage";

describe("region localization", () => {
  it("uses US ketone emergency copy", () => {
    const copy = getKetoneEmergencyCopy("US");
    expect(copy.large).toContain("911");
    expect(copy.large).toContain("ER");
    expect(copy.footer).toContain("911");
  });

  it("uses UK ketone emergency copy", () => {
    const copy = getKetoneEmergencyCopy("UK");
    expect(copy.large).toContain("999");
    expect(copy.large).toContain("A&E");
    expect(copy.footer).toContain("NHS 111");
  });

  it("maps profile region to emergency footer and travel number", () => {
    const usProfile = { region: "US" } as UserProfile;
    const ukProfile = { region: "UK" } as UserProfile;
    expect(getRegionEmergencyFooter(usProfile)).toContain("911");
    expect(travelEnglishEmergencyNumber(usProfile)).toBe("911");
    expect(travelEnglishEmergencyNumber(ukProfile)).toBe("999 / 112");
    expect(getKetoneEmergencyCopyForProfile(usProfile).largeBrief).toContain("911");
  });

  it("serves US-specific medical sources", () => {
    expect(medicalSourcesPageDescription("US")).toContain("United States");
    const sections = getMedicalSourcesSections("US");
    expect(sections.some((s) => s.id === "hypoglycaemia" && s.title.includes("Hypoglycemia"))).toBe(true);
    expect(sections.some((s) => s.links.some((l) => l.href.includes("cdc.gov")))).toBe(true);
  });
});
