import { describe, expect, it } from "vitest";
import {
  DEFAULT_CGM_PREFERENCES,
  hasAnyCgmSourceEnabled,
  hasDexcomShareCredentials,
  hasLibreLinkUpCredentials,
  isCgmPrefillActive,
} from "@/lib/cgm/preferences";

describe("CGM preferences", () => {
  it("activates prefill when dexcom share is configured", () => {
    const prefs = {
      ...DEFAULT_CGM_PREFERENCES,
      prefillEnabled: true,
      dexcomShareEnabled: true,
      dexcomShareUsername: "user@example.com",
      dexcomSharePassword: "secret",
    };
    expect(hasDexcomShareCredentials(prefs)).toBe(true);
    expect(hasAnyCgmSourceEnabled(prefs)).toBe(true);
    expect(isCgmPrefillActive(prefs)).toBe(true);
  });

  it("activates prefill when libre link up is configured", () => {
    const prefs = {
      ...DEFAULT_CGM_PREFERENCES,
      prefillEnabled: true,
      libreLinkUpEnabled: true,
      libreLinkUpEmail: "libre@example.com",
      libreLinkUpPassword: "secret",
    };
    expect(hasLibreLinkUpCredentials(prefs)).toBe(true);
    expect(hasAnyCgmSourceEnabled(prefs)).toBe(true);
    expect(isCgmPrefillActive(prefs)).toBe(true);
  });

  it("requires a source when prefill is enabled", () => {
    const prefs = { ...DEFAULT_CGM_PREFERENCES, prefillEnabled: true };
    expect(isCgmPrefillActive(prefs)).toBe(false);
  });
});
