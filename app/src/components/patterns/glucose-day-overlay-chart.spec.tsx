import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlucoseDayOverlayChart } from "@/components/patterns/glucose-day-overlay-chart";
import type { GlucoseDaySeries } from "@/lib/cgm/glucose-day-overlay";

const series: GlucoseDaySeries[] = [
  {
    dateKey: "2026-10-20",
    label: "Today",
    isMostRecent: true,
    segments: [
      [
        { minuteOfDay: 360, value: 7.2 },
        { minuteOfDay: 720, value: 8.1 },
        { minuteOfDay: 1080, value: 6.4 },
      ],
    ],
  },
];

describe("GlucoseDayOverlayChart dose marks", () => {
  it("renders rapid and long-acting dose ticks with a legend", () => {
    render(
      <GlucoseDayOverlayChart
        series={series}
        units="mmol/L"
        targetRange={{ low: 3.9, high: 10 }}
        doseMarks={[
          { minuteOfDay: 480, kind: "rapid" },
          { minuteOfDay: 485, kind: "rapid" },
          { minuteOfDay: 1320, kind: "long" },
        ]}
        data-testid="chart-overlay"
      />,
    );

    // The two morning rapid doses share a 15-minute bucket; the evening
    // long-acting dose is its own bucket.
    expect(screen.getAllByTestId("glucose-overlay-dose-rapid")).toHaveLength(1);
    expect(screen.getAllByTestId("glucose-overlay-dose-long")).toHaveLength(1);
    expect(screen.getByText("Rapid dose")).toBeTruthy();
    expect(screen.getByText("Long-acting dose")).toBeTruthy();
  });

  it("omits dose legend entries when no doses were logged", () => {
    render(
      <GlucoseDayOverlayChart
        series={series}
        units="mmol/L"
        targetRange={{ low: 3.9, high: 10 }}
        data-testid="chart-overlay"
      />,
    );
    expect(screen.queryByTestId("glucose-overlay-dose-rapid")).toBeNull();
    expect(screen.queryByText("Rapid dose")).toBeNull();
  });
});
