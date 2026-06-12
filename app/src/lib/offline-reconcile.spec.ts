import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileAfterBackOnline } from "./offline-reconcile";

vi.mock("./offline", () => ({
  isOnline: vi.fn(),
}));

vi.mock("./supplies", () => ({
  flushSuppliesOfflineQueue: vi.fn(),
  reconcileSupplies: vi.fn(),
}));

vi.mock("./appointments-supabase", () => ({
  syncAppointments: vi.fn(),
}));

import { isOnline } from "./offline";
import { flushSuppliesOfflineQueue, reconcileSupplies } from "./supplies";
import { syncAppointments } from "./appointments-supabase";

describe("reconcileAfterBackOnline", () => {
  beforeEach(() => {
    vi.mocked(isOnline).mockReset();
    vi.mocked(flushSuppliesOfflineQueue).mockReset();
    vi.mocked(reconcileSupplies).mockReset();
    vi.mocked(syncAppointments).mockReset();
  });

  it("no-ops when still offline", async () => {
    vi.mocked(isOnline).mockReturnValue(false);

    const result = await reconcileAfterBackOnline();

    expect(result.supplies).toEqual({ flushed: 0, skippedNewer: 0, failed: 0 });
    expect(flushSuppliesOfflineQueue).not.toHaveBeenCalled();
    expect(reconcileSupplies).not.toHaveBeenCalled();
    expect(syncAppointments).not.toHaveBeenCalled();
  });

  it("flushes supplies, reconciles, and syncs appointments when online", async () => {
    vi.mocked(isOnline).mockReturnValue(true);
    vi.mocked(flushSuppliesOfflineQueue).mockResolvedValue({
      flushed: 2,
      skippedNewer: 0,
      failed: 0,
    });
    vi.mocked(reconcileSupplies).mockResolvedValue(undefined);
    vi.mocked(syncAppointments).mockResolvedValue(undefined);

    const result = await reconcileAfterBackOnline();

    expect(result.supplies.flushed).toBe(2);
    expect(flushSuppliesOfflineQueue).toHaveBeenCalledOnce();
    expect(reconcileSupplies).toHaveBeenCalledOnce();
    expect(syncAppointments).toHaveBeenCalledWith({ throttleMs: 0 });
  });
});
