import { describe, expect, it } from "vitest";
import {
  filterOfflineCloudNavTabs,
  filterOfflineCloudTools,
  isPatientOnboardingSatisfied,
  resolveAppGateReady,
} from "./offline-app-gate";

describe("resolveAppGateReady", () => {
  it("blocks while auth is loading", () => {
    expect(
      resolveAppGateReady({
        authLoading: true,
        userId: "u1",
        online: true,
        linkQueryFetched: true,
        profileQueryFetched: true,
        skipProfileForGate: false,
      }),
    ).toBe(false);
  });

  it("opens immediately for guests", () => {
    expect(
      resolveAppGateReady({
        authLoading: false,
        userId: undefined,
        online: true,
        linkQueryFetched: false,
        profileQueryFetched: false,
        skipProfileForGate: false,
      }),
    ).toBe(true);
  });

  it("skips cloud gate queries when offline with a session", () => {
    expect(
      resolveAppGateReady({
        authLoading: false,
        userId: "u1",
        online: false,
        linkQueryFetched: false,
        profileQueryFetched: false,
        skipProfileForGate: false,
      }),
    ).toBe(true);
  });

  it("waits for link + profile queries when online", () => {
    expect(
      resolveAppGateReady({
        authLoading: false,
        userId: "u1",
        online: true,
        linkQueryFetched: false,
        profileQueryFetched: false,
        skipProfileForGate: false,
      }),
    ).toBe(false);

    expect(
      resolveAppGateReady({
        authLoading: false,
        userId: "u1",
        online: true,
        linkQueryFetched: true,
        profileQueryFetched: true,
        skipProfileForGate: false,
      }),
    ).toBe(true);
  });
});

describe("isPatientOnboardingSatisfied", () => {
  const base = {
    userId: "u1",
    linkedCarer: false,
    carerPendingBlocksOnboarding: false,
    profileQueryFetched: false,
    onboardingCompleteFromDb: false,
    onboardingCompleteFromLocalStorage: false,
    online: true,
  };

  it("trusts local completion when offline", () => {
    expect(
      isPatientOnboardingSatisfied({
        ...base,
        online: false,
        onboardingCompleteFromLocalStorage: true,
      }),
    ).toBe(true);
  });

  it("does not redirect offline users without local completion", () => {
    expect(
      isPatientOnboardingSatisfied({
        ...base,
        online: false,
      }),
    ).toBe(false);
  });

  it("treats community members as satisfied without clinical onboarding", () => {
    expect(
      isPatientOnboardingSatisfied({
        ...base,
        isCommunityMemberAccount: true,
        onboardingCompleteFromDb: false,
        onboardingCompleteFromLocalStorage: false,
      }),
    ).toBe(true);
  });
});

describe("offline cloud UI filters", () => {
  it("removes coach tool tiles when offline", () => {
    const tools = [
      { id: "ai-coach", title: "Beatie" },
      { id: "hypo-help", title: "Hypo" },
    ];
    expect(filterOfflineCloudTools(tools, true)).toEqual([{ id: "hypo-help", title: "Hypo" }]);
    expect(filterOfflineCloudTools(tools, false)).toEqual(tools);
  });

  it("removes feed and coach nav tabs when offline", () => {
    const tabs = [
      { href: "/", title: "Home" },
      { href: "/community", title: "Feed" },
      { href: "/coach", title: "Beatie" },
      { href: "/tools", title: "Tools" },
    ];
    expect(filterOfflineCloudNavTabs(tabs, true)).toEqual([
      { href: "/", title: "Home" },
      { href: "/tools", title: "Tools" },
    ]);
  });
});
