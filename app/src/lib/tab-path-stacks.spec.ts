import { describe, expect, it, beforeEach } from "vitest";
import {
  hubHrefForTabStack,
  rememberTabPath,
  resolveTabNavigationTarget,
  tabStackIdForPath,
} from "./tab-path-stacks";

describe("tab-path-stacks", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("maps nested tools/guides paths to stack ids", () => {
    expect(tabStackIdForPath("/tools/hypo-help")).toBe("tools");
    expect(tabStackIdForPath("/scenarios/travel")).toBe("scenarios");
    expect(tabStackIdForPath("/travel")).toBe("scenarios");
    expect(tabStackIdForPath("/community/post/abc")).toBe("community");
  });

  it("restores nested tools path when returning from Home", () => {
    rememberTabPath("/tools/hypo-help");
    expect(resolveTabNavigationTarget("/tools", "/")).toBe("/tools/hypo-help");
  });

  it("resets to hub when re-tapping active nested tab", () => {
    rememberTabPath("/tools/hypo-help");
    expect(resolveTabNavigationTarget("/tools", "/tools/hypo-help")).toBe("/tools");
  });

  it("remembers scenarios when switching to tools", () => {
    expect(resolveTabNavigationTarget("/tools", "/scenarios/exercise")).toBe("/tools");
    expect(resolveTabNavigationTarget("/scenarios", "/tools")).toBe("/scenarios/exercise");
  });

  it("hubHrefForTabStack matches bottom nav hubs", () => {
    expect(hubHrefForTabStack("tools")).toBe("/tools");
    expect(hubHrefForTabStack("scenarios")).toBe("/scenarios");
    expect(hubHrefForTabStack("community")).toBe("/community");
  });
});
