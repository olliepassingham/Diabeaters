import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCgmHistory } from "./use-cgm-history";
import { fetchLiveCgmHistory } from "@/lib/cgm/live-cgm-history";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { hasLiveCgmCredentials } from "@/lib/cgm/preferences";

vi.mock("@/lib/cgm/live-cgm-history", () => ({
  fetchLiveCgmHistory: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/cgm/cgm-history-store", () => ({
  getCgmLocalHistory: vi.fn(() => []),
}));

vi.mock("@/lib/cgm/preferences", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cgm/preferences")>("@/lib/cgm/preferences");
  return {
    ...actual,
    hasLiveCgmCredentials: vi.fn(() => false),
  };
});

describe("useCgmHistory", () => {
  it("does not throw when live CGM credentials are missing", async () => {
    vi.mocked(hasLiveCgmCredentials).mockReturnValue(false);
    vi.mocked(getCgmLocalHistory).mockReturnValue([]);
    const { result } = renderHook(() => useCgmHistory("12h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toMatch(/Dexcom Share or LibreLink Up/i);
  });

  it("shows saved readings before the live fetch finishes and keeps them if it fails", async () => {
    const now = Date.now();
    vi.mocked(hasLiveCgmCredentials).mockReturnValue(true);
    vi.mocked(getCgmLocalHistory).mockReturnValue([
      { recordedAtMs: now - 60_000, valueMgDl: 108 },
      { recordedAtMs: now, valueMgDl: 112 },
    ]);
    let finish: (value: null) => void = () => {};
    vi.mocked(fetchLiveCgmHistory).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    const { result } = renderHook(() => useCgmHistory("12h"));

    expect(result.current.points.length).toBe(2);
    expect(result.current.loading).toBe(false);

    finish(null);

    await waitFor(() => {
      expect(result.current.error).toMatch(/saved readings/i);
    });
    expect(result.current.points.length).toBe(2);
  });
});
