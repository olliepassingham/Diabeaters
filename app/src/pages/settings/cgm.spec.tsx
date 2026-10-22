import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { SettingsCgmRoute } from "./cgm";
import { connectDexcomShareCgm } from "@/lib/cgm/registry";

vi.mock("@/lib/native-platform", () => ({
  isCapacitorNativeShell: () => true,
  isIosDevice: () => false,
  isAndroidDevice: () => true,
  getDevicePlatform: () => "android",
  healthPlatformLabel: () => "Health Connect",
}));

vi.mock("@/lib/cgm/health-native-probe", () => ({
  probeHealthNativeBridge: vi.fn(async () => ({ status: "plugin_missing", message: "test" })),
}));

vi.mock("@/lib/cgm/adapters/health-platform", () => ({
  healthPlatformCgmAdapter: {},
}));

vi.mock("@/lib/cgm/registry", () => ({
  connectDexcomShareCgm: vi.fn(async () => ({ ok: true })),
  connectHealthPlatformCgm: vi.fn(async () => ({ ok: true })),
  connectLibreLinkUpCgm: vi.fn(async () => ({ ok: true })),
  disconnectDexcomShareCgm: vi.fn(async () => undefined),
  disconnectLibreLinkUpCgm: vi.fn(async () => undefined),
  getHealthPlatformAccessStatus: vi.fn(async () => ({ granted: false })),
}));

vi.mock("@/lib/open-external-url", () => ({
  openExternalUrl: vi.fn(),
}));

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

const PORTAL_URL =
  "https://uam2.dexcom.com/identity/accounts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/edit";
const ACCOUNT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function renderPage() {
  const { hook } = memoryLocation({ path: "/settings/cgm" });
  return render(
    <Router hook={hook}>
      <SettingsCgmRoute />
    </Router>,
  );
}

describe("SettingsCgmRoute Dexcom portal address field", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(connectDexcomShareCgm).mockClear();
    localStorage.setItem(
      "diabeaters_cgm_prefs_v1",
      JSON.stringify({
        prefillEnabled: true,
        healthPlatformEnabled: false,
        dexcomShareEnabled: true,
        dexcomShareServer: "eu",
        libreLinkUpEnabled: false,
        libreLinkUpRegion: "eu",
      }),
    );
  });

  it("keeps the pasted portal address exactly as entered while editing", () => {
    renderPage();
    const input = screen.getByTestId("input-dexcom-username") as HTMLInputElement;
    fireEvent.change(input, { target: { value: PORTAL_URL } });
    // The field must not rewrite the address into the bare account ID mid-edit.
    expect(input.value).toBe(PORTAL_URL);
  });

  it("explains a Clarity address on blur, without a failed login attempt", async () => {
    renderPage();
    const input = screen.getByTestId("input-dexcom-username") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://clarity.dexcom.eu/" } });
    // No error shouting while still typing…
    expect(screen.queryByText(/That is a Clarity website address/)).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByText(/That is a Clarity website address/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("button-cgm-connect-dexcom"));
    await waitFor(() => expect(screen.getByText(/That is a Clarity website address/)).toBeTruthy());
    expect(connectDexcomShareCgm).not.toHaveBeenCalled();
  });

  it("extracts the account ID from a pasted portal address on Connect", async () => {
    renderPage();
    const input = screen.getByTestId("input-dexcom-username") as HTMLInputElement;
    fireEvent.change(input, { target: { value: PORTAL_URL } });
    fireEvent.change(screen.getByTestId("input-dexcom-password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByTestId("button-cgm-connect-dexcom"));
    await waitFor(() => expect(connectDexcomShareCgm).toHaveBeenCalled());
    expect(vi.mocked(connectDexcomShareCgm).mock.calls[0]?.[0]).toMatchObject({
      username: ACCOUNT_ID,
      password: "secret",
      server: "eu",
    });
  });
});
