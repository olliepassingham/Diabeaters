import { describe, expect, it } from "vitest";
import {
  AI_ASSISTANT_NAME,
  askAssistantMidSentence,
  coachPageTitle,
  coachSupporterTopicScopeHint,
  openAssistantCtaLabel,
} from "./persona";

describe("ai-coach persona", () => {
  it("exports a non-empty display name", () => {
    expect(AI_ASSISTANT_NAME.length).toBeGreaterThan(0);
  });

  it("page titles include the name", () => {
    expect(coachPageTitle("patient")).toBe(AI_ASSISTANT_NAME);
    expect(coachPageTitle("supporter")).toContain(AI_ASSISTANT_NAME);
  });

  it("open CTA is Ask {name}", () => {
    expect(openAssistantCtaLabel()).toBe(`Ask ${AI_ASSISTANT_NAME}`);
  });

  it("mid-sentence phrase is lowercase ask + name", () => {
    expect(askAssistantMidSentence()).toMatch(/^ask /);
  });

  it("supporter topic scope hint reflects age band", () => {
    expect(coachSupporterTopicScopeHint("child")).toMatch(/supporting a child/i);
    expect(coachSupporterTopicScopeHint("teen")).toMatch(/supporting a teenager/i);
    expect(coachSupporterTopicScopeHint("adult")).toMatch(/supporting an adult/i);
    expect(coachSupporterTopicScopeHint("unknown")).toMatch(/supporting a person/i);
  });
});
