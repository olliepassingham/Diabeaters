import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: { getSession: getSessionMock },
    from: () => ({ insert: insertMock }),
  }),
}));

import {
  flushRouteViews,
  normaliseRoute,
  recordRouteView,
  resetRouteAnalyticsForTests,
} from "./route-analytics";

describe("normaliseRoute", () => {
  it("keeps plain routes and strips query/hash", () => {
    expect(normaliseRoute("/scenarios/exercise")).toBe("/scenarios/exercise");
    expect(normaliseRoute("/community?tab=everyone#top")).toBe("/community");
    expect(normaliseRoute("/")).toBe("/");
  });

  it("collapses dynamic segments", () => {
    expect(normaliseRoute("/community/profile/a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "/community/profile/:id",
    );
    expect(normaliseRoute("/community/u/ollie")).toBe("/community/u/:handle");
    expect(normaliseRoute("/community/post/1234567890abcdef")).toBe("/community/post/:id");
    // Short numeric segments are kept — they may be meaningful static steps.
    expect(normaliseRoute("/tools")).toBe("/tools");
  });

  it("blocks auth screens and junk input", () => {
    expect(normaliseRoute("/login?next=%2F")).toBeNull();
    expect(normaliseRoute("/signup")).toBeNull();
    expect(normaliseRoute("")).toBeNull();
    expect(normaliseRoute(null)).toBeNull();
    expect(normaliseRoute("community")).toBeNull();
  });
});

describe("route view queue", () => {
  beforeEach(() => {
    localStorage.clear();
    insertMock.mockReset();
    getSessionMock.mockReset();
    resetRouteAnalyticsForTests();
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    insertMock.mockResolvedValue({ error: null });
  });

  it("records and flushes a normalised batch for the signed-in user", async () => {
    recordRouteView("/scenarios/bedtime?x=1");
    await vi.waitFor(() => expect(insertMock).toHaveBeenCalled());
    await flushRouteViews();

    expect(insertMock).toHaveBeenCalledTimes(1);
    const rows = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "user-1", route: "/scenarios/bedtime" });
    expect(typeof rows[0].created_at).toBe("string");
    // Queue drained after a successful flush.
    expect(localStorage.getItem("diabeater_route_view_queue_v1")).toBe("[]");
  });

  it("ignores consecutive duplicates", async () => {
    recordRouteView("/tools");
    recordRouteView("/tools");
    await vi.waitFor(() => expect(insertMock).toHaveBeenCalled());
    const rows = insertMock.mock.calls[0][0] as unknown[];
    expect(rows).toHaveLength(1);
  });

  it("keeps the queue when signed out", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    recordRouteView("/account");
    await flushRouteViews();
    // Let the fire-and-forget flush from recordRouteView settle too.
    await new Promise((r) => setTimeout(r, 10));
    expect(insertMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("diabeater_route_view_queue_v1")).toContain("/account");
  });

  it("keeps the queue when the insert fails (e.g. migration not applied yet)", async () => {
    insertMock.mockResolvedValue({ error: { message: "relation does not exist" } });
    recordRouteView("/account");
    // recordRouteView triggers a fire-and-forget flush; wait for it, then flush again.
    await flushRouteViews();
    expect(localStorage.getItem("diabeater_route_view_queue_v1")).toContain("/account");
  });
});
