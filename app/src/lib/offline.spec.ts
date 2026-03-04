import { describe, expect, it, beforeEach } from "vitest";
import { enqueue, flushQueue, getQueue, setQueue, type OfflineQueueEntry } from "./offline";

function seed(entries: OfflineQueueEntry[]) {
  setQueue(entries);
}

describe("offline queue", () => {
  beforeEach(() => {
    localStorage.clear();
    setQueue([]);
  });

  it("enqueues and persists entries", () => {
    enqueue({
      kind: "supplies:add",
      clientId: "c1",
      payload: { name: "Test", quantity: 1 },
      clientTs: "2026-01-01T00:00:00.000Z",
    });
    const q = getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe("supplies:add");
  });

  it("flushes in order and clears queue on success", async () => {
    seed([
      { kind: "supplies:add", clientId: "c1", payload: { name: "A", quantity: 1 }, clientTs: "t1" },
      { kind: "supplies:update", payload: { id: "s1", fields: { quantity: 2 } }, baseUpdatedAt: null, clientTs: "t2" },
    ]);

    const seen: string[] = [];
    const res = await flushQueue(async (entry) => {
      seen.push(entry.kind);
      return { status: "ok" };
    });

    expect(seen).toEqual(["supplies:add", "supplies:update"]);
    expect(res.flushed).toBe(2);
    expect(getQueue()).toHaveLength(0);
  });

  it("stops on failure and keeps remaining in order", async () => {
    seed([
      { kind: "supplies:add", clientId: "c1", payload: { name: "A", quantity: 1 }, clientTs: "t1" },
      { kind: "supplies:delete", payload: { id: "s1" }, baseUpdatedAt: null, clientTs: "t2" },
      { kind: "supplies:update", payload: { id: "s2", fields: { quantity: 2 } }, baseUpdatedAt: null, clientTs: "t3" },
    ]);

    let calls = 0;
    await flushQueue(async (entry) => {
      calls += 1;
      if (entry.kind === "supplies:delete") return { status: "failed", error: new Error("nope") };
      return { status: "ok" };
    });

    expect(calls).toBe(2);
    expect(getQueue().map((e) => e.kind)).toEqual(["supplies:delete", "supplies:update"]);
  });
});

