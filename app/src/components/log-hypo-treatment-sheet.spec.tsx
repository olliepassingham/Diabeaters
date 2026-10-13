import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogHypoTreatmentSheet } from "@/components/log-hypo-treatment-sheet";
import type { BgPrefillResult } from "@/lib/cgm/prefill";

const prefillBox = vi.hoisted(() => ({ current: null as BgPrefillResult | null }));

vi.mock("@/hooks/use-session-bg-prefill", () => ({
  useSessionBgPrefill: () => ({
    prefill: prefillBox.current,
    loading: false,
    refresh: vi.fn(),
    fromSupporter: false,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

function liveReading(value: string): BgPrefillResult {
  return {
    value,
    source: "Dexcom · 1 min ago",
    fromCgm: true,
    reading: {
      value: Number(value),
      units: "mmol/L",
      recordedAt: "2026-10-13T14:00:00.000Z",
      source: "dexcom_share",
      sourceLabel: "Dexcom",
      trend: "falling",
      ageMinutes: 1,
      isStale: false,
      stalenessNote: null,
    },
  };
}

describe("LogHypoTreatmentSheet glucose", () => {
  beforeEach(() => {
    prefillBox.current = null;
    localStorage.clear();
  });

  it("shows a large glucose field and fills it from a fresh live reading", () => {
    prefillBox.current = liveReading("3.1");
    render(
      <LogHypoTreatmentSheet open onOpenChange={() => {}} profile={{ bgUnits: "mmol/L" }} onSubmit={() => {}} />,
    );

    const input = screen.getByTestId("input-dashboard-hypo-glucose") as HTMLInputElement;
    expect(input.className).toContain("text-3xl");
    expect(input.value).toBe("3.1");
    expect(screen.getByText("Dexcom · 1 min ago")).not.toBeNull();
  });

  it("leaves the field empty when there is no live reading", () => {
    render(
      <LogHypoTreatmentSheet open onOpenChange={() => {}} profile={{ bgUnits: "mmol/L" }} onSubmit={() => {}} />,
    );
    expect((screen.getByTestId("input-dashboard-hypo-glucose") as HTMLInputElement).value).toBe("");
  });
});
