import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCgmHistory } from "./use-cgm-history";

vi.mock("@/lib/cgm/live-cgm-history", () => ({
  fetchLiveCgmHistory: vi.fn().mockResolvedValue(null),
}));

describe("useCgmHistory", () => {
  it("does not throw when live CGM credentials are missing", async () => {
    const { result } = renderHook(() => useCgmHistory("12h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toMatch(/Dexcom Share or LibreLink Up/i);
  });
});
