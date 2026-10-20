import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DASHBOARD_WIDGET_REGISTRY } from "@/config/dashboard-widgets";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";

const STORAGE_KEY = "diabeaters_dashboard_widgets";

describe("useDashboardWidgets supply runway", () => {
  beforeEach(() => {
    localStorage.clear();
    // Skip the one-time home-order migrations so the merge of saved rows is what runs.
    localStorage.setItem("diabeaters_dash_home_order_v2", "1");
    localStorage.setItem("diabeaters_dash_home_order_v3", "1");
  });

  it("registers supply runway as the first movable home widget", () => {
    expect(DASHBOARD_WIDGET_REGISTRY[0]?.id).toBe("supply-summary");
    expect(DASHBOARD_WIDGET_REGISTRY[0]?.label).toBe("Supply runway");
  });

  it("adds supply runway to a saved layout that predates it", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "community-quick-post", type: "community-quick-post", enabled: true, order: 0, size: "half" },
        { id: "pharmacy", type: "pharmacy", enabled: true, order: 1, size: "half" },
      ]),
    );

    const { result } = renderHook(() => useDashboardWidgets());

    expect(result.current.placements[0]?.id).toBe("supply-summary");
    expect(result.current.placements[0]?.enabled).toBe(true);
    expect(result.current.activeWidgets[0]?.type).toBe("supply-summary");
  });

  it("reorders supply runway with the other widgets", () => {
    const { result } = renderHook(() => useDashboardWidgets());
    const ids = result.current.placements.map((placement) => placement.id);
    const moved = [ids[1]!, ids[0]!, ...ids.slice(2)];

    act(() => result.current.reorderWidgets(moved));

    expect(result.current.placements.map((placement) => placement.id)).toEqual(moved);
    expect(result.current.placements.find((placement) => placement.id === "supply-summary")?.order).toBe(1);
  });

  it("can hide supply runway from home", () => {
    const { result } = renderHook(() => useDashboardWidgets());

    act(() => result.current.toggleWidget("supply-summary", false));

    expect(result.current.activeWidgets.map((widget) => widget.type)).not.toContain("supply-summary");
  });
});
