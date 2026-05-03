import { describe, expect, it } from "vitest";
import {
  AI_ASSISTANT_NAME,
  askAssistantMidSentence,
  coachPageTitle,
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

  it("open CTA includes the name", () => {
    expect(openAssistantCtaLabel()).toContain(AI_ASSISTANT_NAME);
  });

  it("mid-sentence phrase is lowercase ask + name", () => {
    expect(askAssistantMidSentence()).toMatch(/^ask /);
  });
});
