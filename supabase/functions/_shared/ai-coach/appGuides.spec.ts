import { describe, expect, it } from "vitest";
import { matchAppGuide } from "./appGuides.ts";

describe("matchAppGuide", () => {
  it("matches a how-to question to the in-app guide", () => {
    expect(matchAppGuide("How does the exercise guide work?")?.href).toBe("/scenarios/exercise");
    expect(matchAppGuide("Where do I save a meal routine?")?.href).toBe("/routines");
    expect(matchAppGuide("How do I use the meal adviser?")?.href).toBe("/adviser?tab=meal");
  });

  it("prefers the more specific guide", () => {
    expect(matchAppGuide("Where is the activity log for exercise?")?.href).toBe("/tools/activity");
    expect(matchAppGuide("What is a split bolus?")?.href).toBe("/adviser?tab=meal&split=1");
  });

  it("stays quiet when nothing in the app matches", () => {
    expect(matchAppGuide("Hello")).toBeNull();
    expect(matchAppGuide("What is the weather?")).toBeNull();
  });
});
