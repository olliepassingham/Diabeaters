import { describe, expect, it } from "vitest";
import { COACH_TOPIC_SLUGS, getCoachTopicConfig, normalizeCoachTopicParam } from "./topics";

describe("normalizeCoachTopicParam", () => {
  it("returns null for empty or unknown", () => {
    expect(normalizeCoachTopicParam(null)).toBeNull();
    expect(normalizeCoachTopicParam("")).toBeNull();
    expect(normalizeCoachTopicParam("not-a-topic")).toBeNull();
  });

  it("accepts known slugs case-insensitively and maps underscores", () => {
    expect(normalizeCoachTopicParam("Exercise")).toBe("exercise");
    expect(normalizeCoachTopicParam("SICK_DAY")).toBe("sick-day");
    expect(normalizeCoachTopicParam(" sick-day ")).toBe("sick-day");
  });

  it("accepts the supporter slug", () => {
    expect(normalizeCoachTopicParam("supporter")).toBe("supporter");
    expect(normalizeCoachTopicParam("Supporter")).toBe("supporter");
  });

  it("every slug has config", () => {
    for (const slug of COACH_TOPIC_SLUGS) {
      const c = getCoachTopicConfig(slug);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.emptyHint.length).toBeGreaterThan(0);
      expect(c.starters.length).toBeGreaterThan(0);
    }
  });

  it("supporter config has supporter-flavoured copy", () => {
    const c = getCoachTopicConfig("supporter");
    expect(c.label).toMatch(/Supporter/i);
    expect(c.emptyHint.toLowerCase()).toContain("supporting");
    expect(c.starters.length).toBeGreaterThanOrEqual(3);
  });
});
