import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import CgmLivePage from "./cgm-live";

vi.mock("@/hooks/use-cgm-history", () => ({
  useCgmHistory: () => ({
    points: [
      {
        recordedAt: new Date().toISOString(),
        timeMs: Date.now(),
        timeLabel: "21:00",
        value: 11.9,
        trend: "flat" as const,
      },
      {
        recordedAt: new Date(Date.now() - 300_000).toISOString(),
        timeMs: Date.now() - 300_000,
        timeLabel: "20:55",
        value: 11.5,
        trend: "flat" as const,
      },
    ],
    units: "mmol/L" as const,
    loading: false,
    error: null,
    connected: true,
    sourceLabel: "Dexcom Share",
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    storage: {
      ...actual.storage,
      getSettings: () => ({ targetBgLow: 4, targetBgHigh: 10 }),
      getProfile: () => ({ bgUnits: "mmol/L" }),
    },
  };
});

describe("CgmLivePage", () => {
  it("renders without crashing when the history hook is mocked", () => {
    const { hook } = memoryLocation({ path: "/tools/cgm-live" });
    render(
      <Router hook={hook}>
        <CgmLivePage />
      </Router>,
    );
    expect(screen.getByTestId("cgm-live-page")).toBeTruthy();
    expect(screen.getByTestId("cgm-glucose-chart")).toBeTruthy();
    expect(screen.getByTestId("cgm-live-range-status").textContent).toMatch(/Above target/i);
  });
});
