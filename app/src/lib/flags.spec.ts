import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("resolveCommunityEnabled", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@capacitor/core");
  });

  it("is on in dev unless explicitly false", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_FEATURE_COMMUNITY", "");
    const { resolveCommunityEnabled } = await import("./flags");
    expect(resolveCommunityEnabled()).toBe(true);
  });

  it("is off in production web without explicit true", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_FEATURE_COMMUNITY", "");
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => false },
    }));
    const { resolveCommunityEnabled } = await import("./flags");
    expect(resolveCommunityEnabled()).toBe(false);
  });

  it("is on in production native unless explicitly false", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_FEATURE_COMMUNITY", "");
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true },
    }));
    const { resolveCommunityEnabled } = await import("./flags");
    expect(resolveCommunityEnabled()).toBe(true);
  });

  it("respects explicit false on native", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_FEATURE_COMMUNITY", "false");
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true },
    }));
    const { resolveCommunityEnabled } = await import("./flags");
    expect(resolveCommunityEnabled()).toBe(false);
  });
});
