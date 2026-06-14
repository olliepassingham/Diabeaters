import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchNativeAppBadgeCount = vi.fn();
const applyCounts: number[] = [];

vi.mock("@/lib/native-app-badge-count", () => ({
  fetchNativeAppBadgeCount: (...args: unknown[]) => fetchNativeAppBadgeCount(...args),
}));

const getNativePushPlatform = vi.fn(() => "ios" as const);

vi.mock("@/lib/native-platform", () => ({
  isNativePushPlatform: () => true,
  getNativePushPlatform: () => getNativePushPlatform(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "web" },
}));

vi.mock("@/lib/app-icon-badge", () => ({
  AppIconBadge: {
    setCount: vi.fn(async ({ count }: { count: number }) => {
      applyCounts.push(count);
    }),
  },
}));

vi.mock("@capawesome/capacitor-badge", () => ({
  Badge: { set: vi.fn() },
}));

describe("syncNativeAppBadgeNow", () => {
  beforeEach(() => {
    vi.resetModules();
    applyCounts.length = 0;
    fetchNativeAppBadgeCount.mockReset();
    getNativePushPlatform.mockReturnValue("ios");
  });

  it("runs a follow-up sync when another sync is requested while in flight", async () => {
    let resolveFirst!: (value: { count: number; error: Error | null }) => void;
    fetchNativeAppBadgeCount
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ count: 0, error: null });

    const { syncNativeAppBadgeNow, isNativeHomeScreenBadgeEnabled } = await import("@/lib/native-app-badge");

    const first = syncNativeAppBadgeNow();
    const second = syncNativeAppBadgeNow();

    if (isNativeHomeScreenBadgeEnabled()) {
      resolveFirst({ count: 3, error: null });
    }
    await Promise.all([first, second]);

    if (isNativeHomeScreenBadgeEnabled()) {
      expect(fetchNativeAppBadgeCount).toHaveBeenCalledTimes(2);
      expect(applyCounts).toEqual([3, 0]);
    } else {
      expect(fetchNativeAppBadgeCount).not.toHaveBeenCalled();
      expect(applyCounts).toEqual([0, 0]);
    }
  });

  it("always clears the badge while home-screen badge sync is disabled", async () => {
    fetchNativeAppBadgeCount.mockResolvedValue({ count: 3, error: null });

    const { syncNativeAppBadgeNow } = await import("@/lib/native-app-badge");
    await syncNativeAppBadgeNow();

    expect(fetchNativeAppBadgeCount).not.toHaveBeenCalled();
    expect(applyCounts).toEqual([0]);
  });

  it("clears the badge when count resolution fails", async () => {
    const { syncNativeAppBadgeNow, isNativeHomeScreenBadgeEnabled } = await import("@/lib/native-app-badge");
    if (isNativeHomeScreenBadgeEnabled()) {
      fetchNativeAppBadgeCount.mockResolvedValue({ count: 0, error: new Error("network") });
      await syncNativeAppBadgeNow();
      expect(applyCounts).toEqual([0]);
      return;
    }
    await syncNativeAppBadgeNow();
    expect(applyCounts).toEqual([0]);
  });

  it("writes the icon badge on remote server.url shells where Capacitor reports web", async () => {
    const { syncNativeAppBadgeNow, isNativeHomeScreenBadgeEnabled } = await import("@/lib/native-app-badge");
    if (!isNativeHomeScreenBadgeEnabled()) {
      await syncNativeAppBadgeNow();
      expect(applyCounts).toEqual([0]);
      return;
    }

    fetchNativeAppBadgeCount.mockResolvedValue({ count: 2, error: null });
    await syncNativeAppBadgeNow();

    expect(getNativePushPlatform).toHaveBeenCalled();
    expect(applyCounts).toEqual([2]);
  });
});
