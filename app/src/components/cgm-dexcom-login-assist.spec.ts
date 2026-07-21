import { describe, expect, it } from "vitest";
import {
  formatDexcomStoredLoginLabel,
  normalizeDexcomUsernameInput,
  shouldEmphasizeDexcomAccountIdAssist,
} from "@/components/cgm-dexcom-login-assist";

describe("normalizeDexcomUsernameInput", () => {
  it("extracts a UUID from a portal URL", () => {
    expect(
      normalizeDexcomUsernameInput(
        "https://uam2.dexcom.com/identity/accounts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/edit",
      ),
    ).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("leaves email unchanged when no account id is present", () => {
    expect(normalizeDexcomUsernameInput("you@example.com")).toBe("you@example.com");
  });
});

describe("formatDexcomStoredLoginLabel", () => {
  it("abbreviates account ids", () => {
    expect(formatDexcomStoredLoginLabel("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("Account linked (a1b2c3d4…)");
  });
});

describe("shouldEmphasizeDexcomAccountIdAssist", () => {
  it("returns false for empty errors", () => {
    expect(shouldEmphasizeDexcomAccountIdAssist(null)).toBe(false);
    expect(shouldEmphasizeDexcomAccountIdAssist("")).toBe(false);
  });

  it("returns true for typical Share login failures", () => {
    expect(
      shouldEmphasizeDexcomAccountIdAssist(
        "Dexcom rejected that login for Share. Turn on Share… then connect with your account ID",
      ),
    ).toBe(true);
    expect(shouldEmphasizeDexcomAccountIdAssist("Could not sign in with that email or phone.")).toBe(true);
    expect(shouldEmphasizeDexcomAccountIdAssist("Dexcom Share error: 500")).toBe(true);
  });
});
