import { describe, expect, it } from "vitest";
import { COACH_TOPIC_SLUGS, defaultCoachTopicForSession, getCoachTopicConfig, normalizeCoachTopicParam } from "./topics";

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

  it("accepts the community slug", () => {
    expect(normalizeCoachTopicParam("community")).toBe("community");
    expect(normalizeCoachTopicParam("COMMUNITY")).toBe("community");
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

  it("community config has learning-focused copy", () => {
    const c = getCoachTopicConfig("community");
    expect(c.label).toMatch(/Community/i);
    expect(c.emptyHint.toLowerCase()).toContain("community");
    expect(c.starters.some((s) => /hypoglycaemia|hypo/i.test(s))).toBe(true);
  });

  it("defaultCoachTopicForSession prefers supporter, then community, then general", () => {
    expect(defaultCoachTopicForSession({ isSupporter: true, isCommunityMode: true })).toBe("supporter");
    expect(defaultCoachTopicForSession({ isSupporter: false, isCommunityMode: true })).toBe("community");
    expect(defaultCoachTopicForSession({ isSupporter: false, isCommunityMode: false })).toBe("general");
  });
});
