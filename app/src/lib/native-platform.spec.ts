import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorState = {
  platform: "web" as string,
  isNativePlatform: true,
};

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => capacitorState.platform,
    isNativePlatform: () => capacitorState.isNativePlatform,
  },
}));

describe("getNativePushPlatform", () => {
  beforeEach(() => {
    vi.resetModules();
    capacitorState.platform = "web";
    capacitorState.isNativePlatform = true;
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    });
  });

  it("returns ios for Capacitor web shell with a trimmed iPhone user agent", async () => {
    const { getNativePushPlatform } = await import("@/lib/native-platform");
    expect(getNativePushPlatform()).toBe("ios");
  });

  it("returns ios for Capacitor web native shell when the UA is trimmed and not iOS-like", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 AppleWebKit/605.1.15 Mobile/15E148",
      maxTouchPoints: 5,
    });
    const { getNativePushPlatform } = await import("@/lib/native-platform");
    expect(getNativePushPlatform()).toBe("ios");
  });

  it("returns android for Capacitor web native shell with an Android user agent", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
      maxTouchPoints: 5,
    });
    const { getNativePushPlatform } = await import("@/lib/native-platform");
    expect(getNativePushPlatform()).toBe("android");
  });
});
