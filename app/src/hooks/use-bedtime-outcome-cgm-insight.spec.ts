import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBedtimeOutcomeCgmInsight } from "@/hooks/use-bedtime-outcome-cgm-insight";
import type { BedtimeLog } from "@/lib/storage";
import type { LiveCgmGlucoseEntry } from "@/lib/cgm/live-cgm-history";

let mockHasCredentials = false;
vi.mock("@/lib/cgm/preferences", () => ({
  hasLiveCgmCredentials: () => mockHasCredentials,
  readCgmPreferences: () => ({}),
}));

const mockFetchHistory = vi.fn<[], Promise<{ entries: LiveCgmGlucoseEntry[] } | null>>();
vi.mock("@/lib/cgm/live-cgm-history", () => ({
  fetchLiveCgmHistory: () => mockFetchHistory(),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    storage: {
      ...actual.storage,
      getSettings: () => ({ targetBgLow: 4.0, targetBgHigh: 10.0 }),
    },
  };
});

function baseLog(overrides: Partial<BedtimeLog> = {}): BedtimeLog {
  return {
    id: "log-1",
    date: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    currentBg: 7.2,
    bgUnits: "mmol/L",
    readinessLevel: "steady",
    hoursSinceFood: 3,
    hoursSinceInsulin: 2,
    hoursUntilSleep: 0,
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
    travelModeActive: false,
    correctionGiven: null,
    notes: "",
    ...overrides,
  };
}

function entry(hoursAgo: number, valueMgDl: number): LiveCgmGlucoseEntry {
  return {
    valueMgDl,
    recordedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    trend: null,
  };
}

describe("useBedtimeOutcomeCgmInsight", () => {
  beforeEach(() => {
    mockHasCredentials = false;
    mockFetchHistory.mockReset();
  });

  it("returns null insight and no loading when there is no log", () => {
    const { result } = renderHook(() => useBedtimeOutcomeCgmInsight(null, "mmol/L"));
    expect(result.current.insight).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("returns null insight when there are no CGM credentials, without fetching", async () => {
    mockHasCredentials = false;
    const { result } = renderHook(() => useBedtimeOutcomeCgmInsight(baseLog(), "mmol/L"));
    expect(result.current.loading).toBe(false);
    expect(result.current.insight).toBeNull();
    expect(mockFetchHistory).not.toHaveBeenCalled();
  });

  it("returns null insight when the fetch has no entries in the sleep window", async () => {
    mockHasCredentials = true;
    mockFetchHistory.mockResolvedValue({ entries: [entry(20, 100)] });
    const { result } = renderHook(() => useBedtimeOutcomeCgmInsight(baseLog(), "mmol/L"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.insight).toBeNull();
  });

  it("builds an insight from overnight readings once fetched", async () => {
    mockHasCredentials = true;
    mockFetchHistory.mockResolvedValue({
      entries: [entry(8, 130), entry(6, 110), entry(2, 112)],
    });
    const { result } = renderHook(() => useBedtimeOutcomeCgmInsight(baseLog(), "mmol/L"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.insight).not.toBeNull();
    expect(result.current.insight!.stats.readingCount).toBe(3);
    expect(result.current.insight!.stats.hadLow).toBe(false);
    expect(result.current.insight!.stats.hadHigh).toBe(false);
  });

  it("returns null insight when the fetch fails", async () => {
    mockHasCredentials = true;
    mockFetchHistory.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useBedtimeOutcomeCgmInsight(baseLog(), "mmol/L"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.insight).toBeNull();
  });
});
