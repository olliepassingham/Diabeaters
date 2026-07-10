import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { ActiveExerciseSession } from "@/lib/storage";

const getBgPrefill = vi.fn<() => Promise<BgPrefillResult | null>>();
const isCgmPrefillActive = vi.fn(() => true);
const updateActiveExercise = vi.fn();
const getActiveExercise = vi.fn<() => ActiveExerciseSession | null>();
const getProfile = vi.fn(() => ({ bgUnits: "mmol/L" }));

vi.mock("@/lib/cgm/prefill", () => ({ getBgPrefill: (...args: unknown[]) => getBgPrefill(...args) }));
vi.mock("@/lib/cgm/preferences", () => ({ isCgmPrefillActive: () => isCgmPrefillActive() }));
vi.mock("@/lib/storage", () => ({
  storage: {
    getActiveExercise: () => getActiveExercise(),
    getProfile: () => getProfile(),
    updateActiveExercise: (...args: unknown[]) => updateActiveExercise(...args),
  },
}));

import {
  shouldSyncLiveCgmToSession,
  syncLiveCgmToActiveExerciseSession,
} from "./exercise-live-cgm-sync";

function activeSession(overrides: Partial<ActiveExerciseSession> = {}): ActiveExerciseSession {
  return {
    id: "s1",
    exerciseName: "Tennis",
    exerciseType: "cardio",
    intensity: "moderate",
    durationMinutes: 60,
    phase: "active",
    startedAt: new Date().toISOString(),
    exerciseStartedAt: new Date().toISOString(),
    recoveryMinutes: 30,
    midCheckDone: false,
    preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
    ...overrides,
  };
}

const freshPrefill = (value: number, recordedAt: string): BgPrefillResult => ({
  value: String(value),
  source: "Apple Health",
  fromCgm: true,
  reading: {
    value,
    units: "mmol/L",
    recordedAt,
    source: "health_platform",
    sourceLabel: "Apple Health",
    trend: "flat",
    ageMinutes: 2,
    isStale: false,
    stalenessNote: null,
  },
});

describe("shouldSyncLiveCgmToSession", () => {
  it("returns true for active session with CGM enabled", () => {
    expect(shouldSyncLiveCgmToSession(activeSession())).toBe(true);
  });

  it("returns false when user manually logged mid BG", () => {
    expect(shouldSyncLiveCgmToSession(activeSession({ midBgSource: "manual", midBg: 5.5 }))).toBe(false);
  });

  it("returns false outside active phase", () => {
    expect(shouldSyncLiveCgmToSession(activeSession({ phase: "pre" }))).toBe(false);
  });
});

describe("syncLiveCgmToActiveExerciseSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCgmPrefillActive.mockReturnValue(true);
  });

  it("writes fresh CGM into session mid fields", async () => {
    const at = "2026-07-09T10:00:00.000Z";
    getActiveExercise.mockReturnValue(activeSession());
    getBgPrefill.mockResolvedValue(freshPrefill(5.8, at));

    const result = await syncLiveCgmToActiveExerciseSession();

    expect(result?.reading?.value).toBe(5.8);
    expect(updateActiveExercise).toHaveBeenCalledWith({
      midBg: 5.8,
      midTrend: "flat",
      midBgAt: at,
      midBgSource: "cgm",
    });
  });

  it("skips write when CGM reading unchanged", async () => {
    const at = "2026-07-09T10:00:00.000Z";
    getActiveExercise.mockReturnValue(
      activeSession({ midBg: 5.8, midBgAt: at, midBgSource: "cgm", midTrend: "flat" }),
    );
    getBgPrefill.mockResolvedValue(freshPrefill(5.8, at));

    await syncLiveCgmToActiveExerciseSession();

    expect(updateActiveExercise).not.toHaveBeenCalled();
  });

  it("does not sync when mid BG was logged manually", async () => {
    getActiveExercise.mockReturnValue(activeSession({ midBgSource: "manual", midBg: 6.2 }));
    getBgPrefill.mockResolvedValue(freshPrefill(5.1, "2026-07-09T10:00:00.000Z"));

    const result = await syncLiveCgmToActiveExerciseSession();

    expect(result).toBeNull();
    expect(updateActiveExercise).not.toHaveBeenCalled();
  });
});
