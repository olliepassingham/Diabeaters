import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as offline from "../src/lib/offline";
import * as supabaseMod from "../src/lib/supabase";
import { storage } from "../src/lib/storage";
import { compareUpdatedAtForSync, flushSuppliesOfflineQueue, reconcilePairWinnerForTest, syncToCloud } from "../src/lib/supplies";

vi.mock("../src/lib/supabase", () => ({
  getSupabase: vi.fn(),
}));

describe("supplies sync", () => {
  beforeEach(() => {
    localStorage.clear();
    offline.setQueue([]);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("compareUpdatedAtForSync picks newer side", () => {
    expect(compareUpdatedAtForSync("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(
      "local",
    );
    expect(compareUpdatedAtForSync("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(
      "cloud",
    );
    expect(compareUpdatedAtForSync("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(
      "tie",
    );
  });

  it("reconcilePairWinnerForTest treats tie as local", () => {
    expect(
      reconcilePairWinnerForTest(
        { updated_at: "2026-01-01T00:00:00.000Z" },
        { updated_at: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBe("local");
  });

  it("reconcilePairWinnerForTest prefers a newer pickup over a stale updated_at", () => {
    expect(
      reconcilePairWinnerForTest(
        {
          updated_at: "2026-01-01T00:00:00.000Z",
          lastPickupDate: "2026-06-01T12:00:00.000Z",
        },
        { updated_at: "2026-03-01T00:00:00.000Z" },
      ),
    ).toBe("local");
  });

  it("syncToCloud inserts and stores cloud_id on local row", async () => {
    const updateSpy = vi.spyOn(storage, "updateSupply").mockReturnValue(null);

    const single = vi.fn().mockResolvedValue({
      data: { id: "cloud-row-1", updated_at: "2026-03-01T12:00:00.000Z" },
      error: null,
    });

    vi.spyOn(supabaseMod, "getSupabase").mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: () => ({
        insert: () => ({
          select: () => ({ single }),
        }),
      }),
    } as never);

    await syncToCloud({
      id: "local-1",
      name: "Pen needles",
      type: "needle",
      currentQuantity: 3,
      dailyUsage: 0,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      "local-1",
      expect.objectContaining({
        cloud_id: "cloud-row-1",
        updated_at: "2026-03-01T12:00:00.000Z",
      }),
    );
  });

  it("syncToCloud updates existing cloud row when cloud_id is set", async () => {
    const updateSpy = vi.spyOn(storage, "updateSupply").mockReturnValue(null);

    const single = vi.fn().mockResolvedValue({
      data: { id: "cloud-row-2", updated_at: "2026-03-02T12:00:00.000Z" },
      error: null,
    });

    vi.spyOn(supabaseMod, "getSupabase").mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({ single }),
            }),
          }),
        }),
      }),
    } as never);

    await syncToCloud({
      id: "local-2",
      name: "Pen needles",
      type: "needle",
      currentQuantity: 4,
      dailyUsage: 0,
      cloud_id: "cloud-row-2",
      updated_at: "2026-03-01T00:00:00.000Z",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      "local-2",
      expect.objectContaining({
        updated_at: "2026-03-02T12:00:00.000Z",
      }),
    );
  });

  it("queues local sync when offline", async () => {
    vi.spyOn(offline, "isOnline").mockReturnValue(false);

    vi.spyOn(supabaseMod, "getSupabase").mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    } as never);

    await syncToCloud({
      id: "local-off",
      name: "CGM",
      type: "cgm",
      currentQuantity: 1,
      dailyUsage: 0,
    });

    const q = offline.getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe("supplies:local-sync");
  });

  it("flushSuppliesOfflineQueue processes supplies:local-sync when online", async () => {
    vi.spyOn(offline, "isOnline").mockReturnValue(true);

    const single = vi.fn().mockResolvedValue({
      data: { id: "new-cloud", updated_at: "2026-04-01T00:00:00.000Z" },
      error: null,
    });

    vi.spyOn(supabaseMod, "getSupabase").mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: () => ({
        insert: () => ({
          select: () => ({ single }),
        }),
      }),
    } as never);

    const updateSpy = vi.spyOn(storage, "updateSupply").mockReturnValue(null);

    offline.enqueue({
      kind: "supplies:local-sync",
      localId: "flush-local",
      payload: {
        cloudId: null,
        name: "Strips",
        quantity: 2,
        unit: "box",
        category: "other",
        notes: null,
        updated_at: "2026-04-01T00:00:00.000Z",
      },
      clientTs: "2026-04-01T00:00:00.000Z",
    });

    const res = await flushSuppliesOfflineQueue();
    expect(res.flushed).toBe(1);
    expect(offline.getQueue()).toHaveLength(0);
    expect(updateSpy).toHaveBeenCalled();
  });

  it("importSupplyFromCloudReconcile keeps newer local stock instead of cloning", () => {
    storage.addSupply({
      name: "Infusion Sets",
      type: "infusion_set",
      currentQuantity: 10,
      dailyUsage: 0,
    });
    expect(storage.getSupplies()).toHaveLength(1);

    storage.importSupplyFromCloudReconcile({
      id: "cloud-sets-1",
      name: "Infusion Sets",
      quantity: 8,
      updated_at: "2020-01-01T00:00:00.000Z",
      category: "infusion_set",
    });

    const list = storage.getSupplies();
    expect(list).toHaveLength(1);
    expect(list[0].cloud_id).toBe("cloud-sets-1");
    expect(list[0].currentQuantity).toBe(10);
  });

  it("importSupplyFromCloudReconcile applies newer cloud quantity", () => {
    storage.addSupply({
      name: "Infusion Sets",
      type: "infusion_set",
      currentQuantity: 10,
      dailyUsage: 0,
    });
    const id = storage.getSupplies()[0]!.id;
    storage.updateSupply(id, { updated_at: "2020-01-01T00:00:00.000Z", lastPickupDate: "2020-01-01T00:00:00.000Z" });

    storage.importSupplyFromCloudReconcile({
      id: "cloud-sets-2",
      name: "Infusion Sets",
      quantity: 8,
      updated_at: "2026-08-21T00:00:00.000Z",
      category: "infusion_set",
    });

    const list = storage.getSupplies();
    expect(list).toHaveLength(1);
    expect(list[0].currentQuantity).toBe(8);
  });

  it("dedupeSuppliesByNameAndType removes local clones", () => {
    localStorage.setItem(
      "diabeater_supplies",
      JSON.stringify([
        {
          id: "a",
          name: "Infusion Sets",
          type: "infusion_set",
          currentQuantity: 10,
          dailyUsage: 0,
          cloud_id: "cloud-a",
        },
        {
          id: "b",
          name: "Infusion Sets",
          type: "infusion_set",
          currentQuantity: 10,
          dailyUsage: 0,
        },
        {
          id: "c",
          name: "Reservoirs / Cartridges",
          type: "reservoir",
          currentQuantity: 10,
          dailyUsage: 0,
        },
      ]),
    );

    const removed = storage.dedupeSuppliesByNameAndType();
    expect(removed).toEqual(["b"]);
    const list = storage.getSupplies();
    expect(list).toHaveLength(2);
    expect(list.find((s) => s.type === "infusion_set")?.id).toBe("a");
  });

  it("dedupeSuppliesByNameAndType keeps the higher stock row", () => {
    localStorage.setItem(
      "diabeater_supplies",
      JSON.stringify([
        {
          id: "cloud-low",
          name: "Needles",
          type: "needle",
          currentQuantity: 10,
          dailyUsage: 4,
          cloud_id: "cloud-a",
        },
        {
          id: "local-high",
          name: "Needles",
          type: "needle",
          currentQuantity: 110,
          dailyUsage: 4,
        },
      ]),
    );

    const removed = storage.dedupeSuppliesByNameAndType();
    expect(removed).toEqual(["cloud-low"]);
    expect(storage.getSupplies()[0]?.id).toBe("local-high");
  });
});
