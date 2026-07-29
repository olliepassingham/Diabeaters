import { describe, expect, it } from "vitest";
import {
  cgmAdapterAttemptBudgetMs,
  prioritizeCgmAdapterIds,
} from "@/lib/cgm/registry";
import type { CgmSourceId } from "@/lib/cgm/types";

describe("prioritizeCgmAdapterIds", () => {
  it("puts near-live Share/Libre/Nightscout before the phone health store", () => {
    const ordered = prioritizeCgmAdapterIds([
      "health_platform",
      "dexcom_share",
      "libre_link_up",
    ]);
    expect(ordered).toEqual(["dexcom_share", "libre_link_up", "health_platform"]);
  });

  it("preserves relative order within live and delayed groups", () => {
    const ordered = prioritizeCgmAdapterIds([
      "nightscout",
      "health_platform",
      "dexcom_share",
    ]);
    expect(ordered).toEqual(["nightscout", "dexcom_share", "health_platform"]);
  });

  it("returns health-only lists unchanged", () => {
    expect(prioritizeCgmAdapterIds(["health_platform"])).toEqual(["health_platform"]);
  });
});

describe("cgmAdapterAttemptBudgetMs", () => {
  const withLive: CgmSourceId[] = ["dexcom_share", "health_platform"];
  const soloHealth: CgmSourceId[] = ["health_platform"];

  it("shortens the Health Connect budget when a live source is also enabled", () => {
    expect(cgmAdapterAttemptBudgetMs("health_platform", withLive)).toBe(5_000);
    expect(cgmAdapterAttemptBudgetMs("health_platform", soloHealth)).toBe(12_000);
  });

  it("gives live sources enough room for their own Share/Libre timeouts", () => {
    expect(cgmAdapterAttemptBudgetMs("dexcom_share", withLive)).toBe(12_000);
    expect(cgmAdapterAttemptBudgetMs("libre_link_up", withLive)).toBe(12_000);
  });
});
