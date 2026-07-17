import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CgmLiveBgChip } from "@/components/cgm-live-bg-chip";
import type { BgPrefillResult } from "@/lib/cgm/prefill";

const prefill: BgPrefillResult = {
  fromCgm: true,
  value: "5.6",
  source: "Dexcom Share",
  reading: {
    value: 5.6,
    units: "mmol/L",
    recordedAt: new Date().toISOString(),
    ageMinutes: 2,
    isStale: false,
    trend: "flat",
    source: "dexcom_share",
    sourceLabel: "Dexcom Share",
    stalenessNote: null,
  },
};

describe("CgmLiveBgChip", () => {
  it("uses openLabel for the open control aria-label", () => {
    const onOpen = vi.fn();
    render(<CgmLiveBgChip prefill={prefill} onOpen={onOpen} openLabel="Open live glucose" />);
    const openBtn = screen.getByTestId("button-cgm-live-chip-open");
    expect(openBtn.getAttribute("aria-label")).toBe("Open live glucose");
    fireEvent.click(openBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("defaults openLabel to Open live glucose", () => {
    render(<CgmLiveBgChip prefill={prefill} onOpen={() => {}} />);
    expect(screen.getByTestId("button-cgm-live-chip-open").getAttribute("aria-label")).toBe(
      "Open live glucose",
    );
  });

  it("shows waiting chip when showWaiting and no reading", () => {
    const onOpen = vi.fn();
    render(
      <CgmLiveBgChip
        prefill={null}
        showWaiting
        waitingLabel="Waiting for live BG"
        openLabel="Open live glucose"
        onOpen={onOpen}
      />,
    );
    expect(screen.getByTestId("cgm-live-bg-chip-waiting")).toBeTruthy();
    expect(screen.getByText("Waiting for live BG")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-cgm-live-chip-open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("hides when no reading and showWaiting is false", () => {
    const { container } = render(<CgmLiveBgChip prefill={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows range badge when rangeStatus is provided", () => {
    render(
      <CgmLiveBgChip prefill={prefill} onOpen={() => {}} rangeStatus="high" openLabel="Open live glucose" />,
    );
    expect(screen.getByText("Above target")).toBeTruthy();
    expect(screen.getByText(/2 min ago/)).toBeTruthy();
  });
});
