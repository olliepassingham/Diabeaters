import { describe, expect, it } from "vitest";
import { planSupporterCgmShare } from "@/lib/supporter-cgm-share";

describe("planSupporterCgmShare", () => {
  it("registers when sharing is on and nothing is stored yet", () => {
    expect(
      planSupporterCgmShare({
        sharingEnabled: true,
        last: null,
        fingerprint: "eu|acct|pw|mmol/L|4|10",
        now: 1_000,
        refreshMs: 60_000,
      }),
    ).toBe("register");
  });

  it("skips a repeat register inside the refresh window", () => {
    expect(
      planSupporterCgmShare({
        sharingEnabled: true,
        last: { mode: "registered", fingerprint: "same", at: 1_000 },
        fingerprint: "same",
        now: 30_000,
        refreshMs: 60_000,
      }),
    ).toBe("skip");
  });

  it("clears the stored login when sharing turns off", () => {
    expect(
      planSupporterCgmShare({
        sharingEnabled: false,
        last: { mode: "registered", fingerprint: "same", at: 1_000 },
        fingerprint: "",
        now: 2_000,
        refreshMs: 60_000,
      }),
    ).toBe("clear");
  });

  it("does not keep asking to clear after the login is already removed", () => {
    expect(
      planSupporterCgmShare({
        sharingEnabled: false,
        last: { mode: "cleared", fingerprint: "", at: 1_000 },
        fingerprint: "",
        now: 2_000,
        refreshMs: 60_000,
      }),
    ).toBe("skip");
  });
});
