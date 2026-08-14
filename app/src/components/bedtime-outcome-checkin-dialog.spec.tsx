import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BedtimeOutcomeCheckinDialog } from "@/components/bedtime-outcome-checkin-dialog";
import type { BedtimeLog } from "@/lib/storage";
import type { BedtimeOvernightInsight } from "@/lib/bedtime-overnight-analysis";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockUpdateBedtimeLog = vi.fn();
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    storage: {
      ...actual.storage,
      updateBedtimeLog: (...args: unknown[]) => mockUpdateBedtimeLog(...args),
    },
  };
});

let mockCgmInsight: { insight: BedtimeOvernightInsight | null; loading: boolean } = {
  insight: null,
  loading: false,
};
vi.mock("@/hooks/use-bedtime-outcome-cgm-insight", () => ({
  useBedtimeOutcomeCgmInsight: () => mockCgmInsight,
}));

function baseLog(overrides: Partial<BedtimeLog> = {}): BedtimeLog {
  return {
    id: "log-1",
    date: new Date().toISOString(),
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

function baseInsight(overrides: Partial<BedtimeOvernightInsight> = {}): BedtimeOvernightInsight {
  return {
    headline: "In range overnight",
    summary: "Every reading stayed within your 4.0–10.0 target.",
    explanations: [],
    considerations: [],
    stats: {
      readingCount: 10,
      min: 5.8,
      max: 7.1,
      minAtMs: Date.now(),
      maxAtMs: Date.now(),
      startValue: 7.0,
      endValue: 6.2,
      overnightDelta: -0.8,
      firstHalfAvg: 6.8,
      secondHalfAvg: 6.3,
      inRangePercent: 100,
      hadLow: false,
      hadHigh: false,
    },
    sleepWindowLabel: "11:00 PM – 7:00 AM",
    targetLow: 4.0,
    targetHigh: 10.0,
    readings: [],
    ...overrides,
  };
}

describe("BedtimeOutcomeCheckinDialog", () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockUpdateBedtimeLog.mockReset();
    mockCgmInsight = { insight: null, loading: false };
  });

  it("renders nothing when there is no log", () => {
    const { container } = render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("requires a manual selection with no CGM data, and shows no auto-fill note", () => {
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} />);
    expect((screen.getByTestId("button-bedtime-outcome-save") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("text-bedtime-outcome-cgm-prefilled")).toBeNull();
  });

  it("shows a checking indicator while CGM history is still loading", () => {
    mockCgmInsight = { insight: null, loading: true };
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} />);
    expect(screen.getByText(/Checking your CGM/i)).toBeTruthy();
  });

  it("pre-fills feel from a steady CGM insight, enabling Save immediately", () => {
    mockCgmInsight = { insight: baseInsight(), loading: false };
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} />);

    expect(screen.getByTestId("text-bedtime-outcome-cgm-prefilled")).toBeTruthy();
    expect(screen.queryByTestId("input-bedtime-outcome-morning-bg")).toBeNull();
    expect((screen.getByTestId("button-bedtime-outcome-save") as HTMLButtonElement).disabled).toBe(false);
  });

  it("prioritises a logged low over a high when a night had both", () => {
    mockCgmInsight = {
      insight: baseInsight({ stats: { ...baseInsight().stats, hadLow: true, hadHigh: true } }),
      loading: false,
    };
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} />);
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-save"));
    expect(mockUpdateBedtimeLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({ outcome: expect.objectContaining({ overnightFeel: "went_low" }) }),
    );
  });

  it("stores the CGM morning reading even when the extra field stays hidden", () => {
    mockCgmInsight = { insight: baseInsight(), loading: false };
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} />);
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-save"));
    expect(mockUpdateBedtimeLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({ outcome: expect.objectContaining({ morningBg: 6.2 }) }),
    );
  });

  it("clears the CGM-prefilled note once the user taps a different feel option", () => {
    mockCgmInsight = { insight: baseInsight(), loading: false };
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} />);
    expect(screen.getByTestId("text-bedtime-outcome-cgm-prefilled")).toBeTruthy();

    fireEvent.click(screen.getByTestId("button-bedtime-outcome-feel-went_high"));
    expect(screen.queryByTestId("text-bedtime-outcome-cgm-prefilled")).toBeNull();
  });

  it("saves a fully manual entry when no CGM data is available", () => {
    const onSaved = vi.fn();
    render(<BedtimeOutcomeCheckinDialog open onOpenChange={() => {}} log={baseLog()} onSaved={onSaved} />);

    fireEvent.click(screen.getByTestId("button-bedtime-outcome-feel-went_low"));
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-save"));

    expect(mockUpdateBedtimeLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({ outcome: expect.objectContaining({ overnightFeel: "went_low" }) }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("still asks whether the suggested action was followed even when CGM pre-fills the rest", () => {
    mockCgmInsight = { insight: baseInsight(), loading: false };
    render(
      <BedtimeOutcomeCheckinDialog
        open
        onOpenChange={() => {}}
        log={baseLog({ actionSuggested: "correction" })}
      />,
    );
    expect(screen.getByText(/Followed the correction/i)).toBeTruthy();
    expect(screen.getByTestId("button-bedtime-outcome-followed-yes")).toBeTruthy();
    expect(screen.getByText(/7\.2 mmol\/L/i)).toBeTruthy();
  });

  it("closes as soon as the night is saved, with the tip in a toast", () => {
    const onOpenChange = vi.fn();
    render(
      <BedtimeOutcomeCheckinDialog
        open
        onOpenChange={onOpenChange}
        log={baseLog({ actionSuggested: "correction" })}
      />,
    );
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-feel-went_high"));
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-followed-no"));
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-save"));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/skipping/i) }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("skip dismisses without saving", () => {
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    render(
      <BedtimeOutcomeCheckinDialog open onOpenChange={onOpenChange} log={baseLog()} onSaved={onSaved} />,
    );
    fireEvent.click(screen.getByTestId("button-bedtime-outcome-skip"));
    expect(mockUpdateBedtimeLog).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalled();
  });
});
