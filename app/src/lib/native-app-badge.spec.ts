import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchNativeAppBadgeCount = vi.fn();
const applyCounts: number[] = [];

vi.mock("@/lib/native-app-badge-count", () => ({
  fetchNativeAppBadgeCount: (...args: unknown[]) => fetchNativeAppBadgeCount(...args),
}));

vi.mock("@/lib/native-platform", () => ({
  isNativePushPlatform: () => true,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "ios" },
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

    const { syncNativeAppBadgeNow } = await import("@/lib/native-app-badge");

    const first = syncNativeAppBadgeNow();
    const second = syncNativeAppBadgeNow();

    resolveFirst({ count: 3, error: null });
    await Promise.all([first, second]);

    expect(fetchNativeAppBadgeCount).toHaveBeenCalledTimes(2);
    expect(applyCounts).toEqual([3, 0]);
  });

  it("clears the badge when count resolution fails", async () => {
    fetchNativeAppBadgeCount.mockResolvedValue({ count: 0, error: new Error("network") });

    const { syncNativeAppBadgeNow } = await import("@/lib/native-app-badge");
    await syncNativeAppBadgeNow();

    expect(applyCounts).toEqual([0]);
  });
});
