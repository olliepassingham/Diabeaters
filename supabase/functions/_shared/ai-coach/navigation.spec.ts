import { describe, expect, it } from "vitest";
import { APP_NAVIGATION_DESTINATIONS, hasNavigationIntent, matchAppNavigation } from "./navigation.ts";
import { ALLOWED_HREFS } from "./types.ts";

describe("matchAppNavigation", () => {
  it("answers where-questions with a spoken path and a matching button", () => {
    const reply = matchAppNavigation("Where do I find my hypo history?");
    expect(reply).not.toBeNull();
    expect(reply!.reply).toContain("Tools → Hypo history");
    expect(reply!.suggestedNextActions[0]).toEqual({ label: "Open Hypo history", href: "/tools/hypo-history" });
    expect(reply!.deferToTeam).toBe(false);
  });

  it("routes common setup questions to the right settings screen", () => {
    expect(matchAppNavigation("Where do I change my ratios?")?.suggestedNextActions[0]?.href).toBe("/settings/ratios");
    expect(matchAppNavigation("How do I turn off notifications?")?.suggestedNextActions[0]?.href).toBe(
      "/settings/notifications",
    );
    expect(matchAppNavigation("Where do I connect my Dexcom?")?.suggestedNextActions[0]?.href).toBe("/settings/cgm");
    expect(matchAppNavigation("Where do I change my date of birth?")?.suggestedNextActions[0]?.href).toBe(
      "/settings/usage",
    );
  });

  it("routes tools and guides by name", () => {
    expect(matchAppNavigation("I can't find the bedtime guide")?.suggestedNextActions[0]?.href).toBe(
      "/scenarios/bedtime",
    );
    expect(matchAppNavigation("Where is the supply tracker?")?.suggestedNextActions[0]?.href).toBe("/supplies");
    expect(matchAppNavigation("Show me my achievements")?.suggestedNextActions[0]?.href).toBe("/tools/achievements");
    expect(matchAppNavigation("How do I get to my messages?")?.suggestedNextActions[0]?.href).toBe(
      "/community/messages",
    );
    expect(matchAppNavigation("Where do I set my @handle?".replace("@", ""))?.suggestedNextActions[0]?.href).toBe(
      "/community/setup",
    );
  });

  it("includes the parent hub as a second button for leaf screens", () => {
    const reply = matchAppNavigation("Where do I find my hypo history?");
    expect(reply!.suggestedNextActions).toContainEqual({ label: "Open Tools", href: "/tools" });
  });

  it("stays quiet for education questions with no navigation intent", () => {
    expect(matchAppNavigation("What is a carb ratio?")).toBeNull();
    expect(matchAppNavigation("What does basal mean?")).toBeNull();
    expect(matchAppNavigation("Hello")).toBeNull();
    expect(hasNavigationIntent("What is a carb ratio?")).toBe(false);
  });

  it("leaves acute self-reports to the safety interceptor", () => {
    expect(matchAppNavigation("I'm having a hypo, where is hypo help?")).toBeNull();
    expect(matchAppNavigation("I feel low — where do I log this?")).toBeNull();
    expect(matchAppNavigation("My ketones are high, where is the sick day guide?")).toBeNull();
  });

  it("age-gates alcohol and driving destinations", () => {
    const adult = matchAppNavigation("Where is the alcohol guide?", { ageYears: 34 });
    expect(adult?.suggestedNextActions[0]?.href).toBe("/scenarios/alcohol");

    const teen = matchAppNavigation("Where is the alcohol guide?", { ageYears: 15 });
    expect(teen?.suggestedNextActions.map((a) => a.href)).not.toContain("/scenarios/alcohol");

    const unknown = matchAppNavigation("Where is the alcohol guide?");
    expect(unknown?.suggestedNextActions[0]?.href).toBe("/settings/usage");

    const youngDriver = matchAppNavigation("Where is the driving guide?", { ageYears: 16 });
    expect(youngDriver?.suggestedNextActions.map((a) => a.href)).not.toContain("/scenarios/driving");
    const driver = matchAppNavigation("Where is the driving guide?", { ageYears: 17 });
    expect(driver?.suggestedNextActions[0]?.href).toBe("/scenarios/driving");
  });

  it("offers the three hubs when a navigation question matches nothing specific", () => {
    const reply = matchAppNavigation("Where in the app do I sort out my data export?");
    expect(reply).not.toBeNull();
    expect(reply!.suggestedNextActions.map((a) => a.href)).toEqual(["/tools", "/scenarios", "/settings"]);
  });

  it("only uses allow-listed hrefs", () => {
    for (const destination of APP_NAVIGATION_DESTINATIONS) {
      expect(ALLOWED_HREFS).toContain(destination.href);
    }
  });
});
