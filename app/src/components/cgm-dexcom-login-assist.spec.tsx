import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DexcomLoginAssist } from "@/components/cgm-dexcom-login-assist";
import {
  dexcomUsernameInputNotice,
  formatDexcomStoredLoginLabel,
  normalizeDexcomUsernameInput,
  shouldEmphasizeDexcomAccountIdAssist,
} from "@/components/cgm-dexcom-login-assist";

describe("DexcomLoginAssist", () => {
  it("leads with the account portal and the Clarity password", () => {
    render(<DexcomLoginAssist server="eu" onAccountIdPasted={() => undefined} />);
    expect(screen.getByText("How to connect")).toBeTruthy();
    expect(screen.getByText(/same password as Clarity/i)).toBeTruthy();
    expect(screen.getByText(/Clarity website address will not connect/i)).toBeTruthy();
    expect(screen.getByTestId("button-dexcom-open-portal")).toBeTruthy();
    expect(screen.getByTestId("button-dexcom-paste-account-id")).toBeTruthy();
  });

  it("spells out copying from the browser address bar and what the address looks like", () => {
    render(<DexcomLoginAssist server="eu" onAccountIdPasted={() => undefined} />);
    expect(screen.getByText(/web address at the top of your browser/i)).toBeTruthy();
    expect(screen.getByText(/Come back here and tap/i)).toBeTruthy();
    expect(screen.getByText(/uam2\.dexcom\.com/)).toBeTruthy();
  });

  it("shows the US portal host for the US server", () => {
    render(<DexcomLoginAssist server="us" onAccountIdPasted={() => undefined} />);
    expect(screen.getByText(/uam1\.dexcom\.com/)).toBeTruthy();
  });
});

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

describe("dexcomUsernameInputNotice", () => {
  it("accepts a portal address", () => {
    expect(
      dexcomUsernameInputNotice(
        "https://uam2.dexcom.com/identity/accounts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/edit",
      ),
    ).toBeNull();
  });

  it("rejects a Clarity website address", () => {
    expect(dexcomUsernameInputNotice("https://clarity.dexcom.eu/")).toMatch(/Clarity website/);
  });

  it("rejects a web address with no account id", () => {
    expect(dexcomUsernameInputNotice("https://example.com/home")).toMatch(/No account ID/);
  });
});
