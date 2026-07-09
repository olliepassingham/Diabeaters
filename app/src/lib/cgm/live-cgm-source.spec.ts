import { describe, expect, it } from "vitest";
import { resolveLiveCgmHistorySource } from "@/lib/cgm/live-cgm-source";
import { DEFAULT_CGM_PREFERENCES } from "@/lib/cgm/preferences";

describe("resolveLiveCgmHistorySource", () => {
  it("prefers Dexcom when both are configured", () => {
    const prefs = {
      ...DEFAULT_CGM_PREFERENCES,
      prefillEnabled: true,
      dexcomShareEnabled: true,
      dexcomShareUsername: "user@example.com",
      dexcomSharePassword: "secret",
      libreLinkUpEnabled: true,
      libreLinkUpEmail: "libre@example.com",
      libreLinkUpPassword: "secret",
    };
    expect(resolveLiveCgmHistorySource(prefs)).toBe("dexcom_share");
  });

  it("uses Libre when only Libre is configured", () => {
    const prefs = {
      ...DEFAULT_CGM_PREFERENCES,
      prefillEnabled: true,
      libreLinkUpEnabled: true,
      libreLinkUpEmail: "libre@example.com",
      libreLinkUpPassword: "secret",
    };
    expect(resolveLiveCgmHistorySource(prefs)).toBe("libre_link_up");
  });
});
