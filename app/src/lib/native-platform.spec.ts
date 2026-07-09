import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("returns ios when Capacitor web shell has a WKWebView bridge but trimmed UA", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 AppleWebKit/605.1.15 Mobile/15E148",
      maxTouchPoints: 5,
    });
    capacitorState.isNativePlatform = false;
    vi.stubGlobal("window", {
      webkit: { messageHandlers: { bridge: {} } },
    });
    const { getNativePushPlatform } = await import("@/lib/native-platform");
    expect(getNativePushPlatform()).toBe("ios");
  });
});

describe("getDevicePlatform", () => {
  beforeEach(() => {
    vi.resetModules();
    capacitorState.platform = "web";
    capacitorState.isNativePlatform = false;
  });

  it("returns web in a desktop browser", async () => {
    capacitorState.isNativePlatform = false;
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 0,
    });
    const { getDevicePlatform } = await import("@/lib/native-platform");
    expect(getDevicePlatform()).toBe("web");
  });

  it("returns android for a native shell with an Android user agent", async () => {
    capacitorState.isNativePlatform = true;
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
      maxTouchPoints: 5,
    });
    const { getDevicePlatform, healthPlatformLabel } = await import("@/lib/native-platform");
    expect(getDevicePlatform()).toBe("android");
    expect(healthPlatformLabel()).toBe("Health Connect");
  });

  it("returns ios when Capacitor reports ios directly", async () => {
    capacitorState.platform = "ios";
    const { getDevicePlatform, healthPlatformLabel } = await import("@/lib/native-platform");
    expect(getDevicePlatform()).toBe("ios");
    expect(healthPlatformLabel()).toBe("Apple Health");
  });

  it("labels Health Connect on web with an Android user agent", async () => {
    capacitorState.platform = "web";
    capacitorState.isNativePlatform = false;
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
      maxTouchPoints: 5,
    });
    const { healthPlatformLabel } = await import("@/lib/native-platform");
    expect(healthPlatformLabel()).toBe("Health Connect");
  });
});

describe("isCapacitorNativeShell", () => {
  beforeEach(() => {
    vi.resetModules();
    capacitorState.platform = "web";
    capacitorState.isNativePlatform = false;
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 AppleWebKit/605.1.15 Mobile/15E148",
      maxTouchPoints: 5,
    });
  });

  it("returns true for Capacitor WKWebView bridge even when isNativePlatform is false", async () => {
    vi.stubGlobal("window", {
      webkit: { messageHandlers: { capacitor: {} } },
    });
    const { isCapacitorNativeShell } = await import("@/lib/native-platform");
    expect(isCapacitorNativeShell()).toBe(true);
  });
});

describe("native platform offline helpers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    capacitorState.platform = "web";
    capacitorState.isNativePlatform = true;
  });

  it("detects bundled capacitor localhost origin", async () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "localhost",
    } as Location);
    const { isBundledCapacitorOrigin } = await import("@/lib/native-platform");
    expect(isBundledCapacitorOrigin()).toBe(true);
  });

  it("registers service worker on remote native host", async () => {
    capacitorState.platform = "ios";
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "diabeaters.vercel.app",
    } as Location);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    const { shouldRegisterServiceWorker } = await import("@/lib/native-platform");
    expect(shouldRegisterServiceWorker()).toBe(true);
  });

  it("skips service worker on bundled capacitor origin", async () => {
    capacitorState.platform = "ios";
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "localhost",
    } as Location);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    const { shouldRegisterServiceWorker } = await import("@/lib/native-platform");
    expect(shouldRegisterServiceWorker()).toBe(false);
  });
});
