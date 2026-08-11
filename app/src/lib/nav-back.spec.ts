import { describe, expect, it, beforeEach } from "vitest";
import {
  canNavigateBack,
  getBackLabel,
  isRootTabRoute,
  normalizeNavPath,
  resolveBackFallback,
  trackNavHistory,
  hasInAppNavHistory,
} from "./nav-back-routes";

describe("nav-back", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("normalizes paths", () => {
    expect(normalizeNavPath("/settings/notifications?x=1")).toBe("/settings/notifications");
    expect(normalizeNavPath("/settings/usage#dob")).toBe("/settings/usage");
  });

  it("identifies root tab routes", () => {
    expect(isRootTabRoute("/")).toBe(true);
    expect(isRootTabRoute("/tools")).toBe(true);
    expect(isRootTabRoute("/settings/notifications")).toBe(false);
  });

  it("resolves settings sub-page parent", () => {
    expect(resolveBackFallback("/settings/notifications")).toBe("/settings");
    expect(resolveBackFallback("/settings")).toBe("/account");
  });

  it("resolves scenario and tool drill-down parents", () => {
    expect(resolveBackFallback("/scenarios/exercise")).toBe("/scenarios");
    expect(resolveBackFallback("/scenarios/sick-day")).toBe("/scenarios");
    expect(resolveBackFallback("/sick-day")).toBe("/scenarios");
    expect(resolveBackFallback("/tools/hypo-help")).toBe("/tools");
    // Must not point at /tools/routines (that path redirects back to /routines).
    expect(resolveBackFallback("/routines")).toBe("/tools");
  });

  it("treats nested guides as hierarchical drill-downs", async () => {
    const { isGuidesDrilldownPath } = await import("./nav-back-routes");
    expect(isGuidesDrilldownPath("/scenarios/sick-day")).toBe(true);
    expect(isGuidesDrilldownPath("/scenarios")).toBe(false);
    expect(isGuidesDrilldownPath("/tools/hypo-help")).toBe(false);
  });

  it("resolves community thread parent", () => {
    expect(resolveBackFallback("/community/messages/abc-123")).toBe("/community/messages");
    expect(resolveBackFallback("/community/post/xyz")).toBe("/community");
  });

  it("tracks in-app navigation history", () => {
    trackNavHistory("/settings");
    trackNavHistory("/settings/notifications");
    expect(hasInAppNavHistory("/settings/notifications")).toBe(true);
  });

  it("returns the previous in-app path", async () => {
    const { getInAppNavPrev } = await import("./nav-back-routes");
    trackNavHistory("/scenarios/exercise");
    trackNavHistory("/routines");
    expect(getInAppNavPrev("/routines")).toBe("/scenarios/exercise");
  });

  it("allows back on drill-down routes", () => {
    expect(canNavigateBack("/settings/notifications")).toBe(true);
    expect(canNavigateBack("/")).toBe(false);
  });

  it("labels common fallbacks", () => {
    expect(getBackLabel("/settings")).toBe("Settings");
    expect(getBackLabel("/scenarios")).toBe("Guides");
    expect(getBackLabel("/unknown")).toBe("Back");
  });
});
