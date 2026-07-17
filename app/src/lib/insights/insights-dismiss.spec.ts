import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissPatternInsight,
  isPatternInsightDismissed,
  listDismissedPatternInsightIds,
} from "@/lib/insights/insights-dismiss";

const STORAGE_KEY = "diabeater_dismissed_pattern_insights";

describe("pattern insight dismissal store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    expect(listDismissedPatternInsightIds()).toEqual([]);
    expect(isPatternInsightDismissed("hypo-time-cluster:2026-07")).toBe(false);
  });

  it("records dismissals, most recent first", () => {
    dismissPatternInsight("a:2026-07");
    dismissPatternInsight("b:2026-07");
    expect(listDismissedPatternInsightIds()).toEqual(["b:2026-07", "a:2026-07"]);
    expect(isPatternInsightDismissed("a:2026-07")).toBe(true);
    expect(isPatternInsightDismissed("b:2026-07")).toBe(true);
    expect(isPatternInsightDismissed("c:2026-07")).toBe(false);
  });

  it("de-duplicates re-dismissals of the same id", () => {
    dismissPatternInsight("a:2026-07");
    dismissPatternInsight("b:2026-07");
    dismissPatternInsight("a:2026-07");
    expect(listDismissedPatternInsightIds()).toEqual(["a:2026-07", "b:2026-07"]);
  });

  it("caps the stored list at 80 ids, evicting the oldest", () => {
    for (let i = 0; i < 85; i++) {
      dismissPatternInsight(`id-${i}`);
    }
    const ids = listDismissedPatternInsightIds();
    expect(ids).toHaveLength(80);
    expect(ids[0]).toBe("id-84");
    expect(ids).not.toContain("id-0");
    expect(ids).not.toContain("id-4");
    expect(ids).toContain("id-5");
  });

  it("recovers from corrupt storage", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(listDismissedPatternInsightIds()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(listDismissedPatternInsightIds()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["ok", 42, "", null]));
    expect(listDismissedPatternInsightIds()).toEqual(["ok"]);
  });
});
