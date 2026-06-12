import { describe, expect, it, beforeEach } from "vitest";
import { enqueue, setQueue } from "./offline";
import {
  offlineBannerQueuedSuffix,
  offlineQueuedChangesLabel,
  offlineReconcileToasts,
  readOfflineQueuedCount,
} from "./offline-messaging";

describe("offline messaging", () => {
  beforeEach(() => {
    localStorage.clear();
    setQueue([]);
  });

  it("formats queued change labels", () => {
    expect(offlineQueuedChangesLabel(0)).toBe("");
    expect(offlineQueuedChangesLabel(1)).toBe("1 change will sync when you're back online");
    expect(offlineQueuedChangesLabel(3)).toBe("3 changes will sync when you're back online");
  });

  it("reads queued count from the offline queue", () => {
    expect(readOfflineQueuedCount()).toBe(0);
    enqueue({
      kind: "supplies:add",
      clientId: "c1",
      payload: { name: "Strips", quantity: 1 },
      clientTs: new Date().toISOString(),
    });
    expect(readOfflineQueuedCount()).toBe(1);
    expect(offlineBannerQueuedSuffix(1)).toBe("1 change will sync when you're back online");
  });

  it("builds reconcile toasts for flushed, skipped, and failed counts", () => {
    expect(offlineReconcileToasts({ flushed: 0, skippedNewer: 0, failed: 0 })).toEqual([]);

    const ok = offlineReconcileToasts({ flushed: 2, skippedNewer: 0, failed: 0 });
    expect(ok[0]?.title).toBe("Back online");
    expect(ok[0]?.description).toContain("2 queued changes synced");

    const mixed = offlineReconcileToasts({ flushed: 1, skippedNewer: 1, failed: 1 });
    expect(mixed).toHaveLength(3);
    expect(mixed[2]?.variant).toBe("destructive");
  });
});
