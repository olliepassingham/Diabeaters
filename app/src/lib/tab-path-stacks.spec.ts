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

  it("does not restore nested tools when returning from Home — Tools always opens the list", () => {
    rememberTabPath("/tools/hypo-help");
    expect(resolveTabNavigationTarget("/tools", "/")).toBe("/tools");
  });

  it("resets to hub when re-tapping active nested tab", () => {
    rememberTabPath("/tools/hypo-help");
    expect(resolveTabNavigationTarget("/tools", "/tools/hypo-help")).toBe("/tools");
  });

  it("Guides and Tools hubs always open their lists", () => {
    expect(resolveTabNavigationTarget("/tools", "/scenarios/exercise")).toBe("/tools");
    expect(resolveTabNavigationTarget("/scenarios", "/tools")).toBe("/scenarios");
  });

  it("Guides tab always returns to the guides list even when a nested guide was remembered", () => {
    rememberTabPath("/scenarios/sick-day");
    expect(resolveTabNavigationTarget("/scenarios", "/")).toBe("/scenarios");
    expect(resolveTabNavigationTarget("/scenarios", "/scenarios/sick-day")).toBe("/scenarios");
  });

  it("Tools tab always returns to the tools list even when a nested tool was remembered", () => {
    rememberTabPath("/tools/cgm-live");
    expect(resolveTabNavigationTarget("/tools", "/scenarios")).toBe("/tools");
    expect(resolveTabNavigationTarget("/tools", "/tools/cgm-live")).toBe("/tools");
  });

  it("Account tab always opens the account hub even when a nested page was remembered", () => {
    rememberTabPath("/settings");
    expect(resolveTabNavigationTarget("/account", "/")).toBe("/account");
    expect(resolveTabNavigationTarget("/account", "/settings")).toBe("/account");
    expect(resolveTabNavigationTarget("/account", "/family-carers")).toBe("/account");
    expect(resolveTabNavigationTarget("/account", "/mode")).toBe("/account");
  });

  it("hubHrefForTabStack matches bottom nav hubs", () => {
    expect(hubHrefForTabStack("tools")).toBe("/tools");
    expect(hubHrefForTabStack("scenarios")).toBe("/scenarios");
    expect(hubHrefForTabStack("community")).toBe("/community");
  });
});
