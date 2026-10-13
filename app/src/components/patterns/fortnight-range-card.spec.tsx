import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FortnightRangeCard } from "@/components/patterns/fortnight-range-card";
import type { FortnightRangePicture } from "@/lib/cgm/fortnight-range";

const picture: FortnightRangePicture = {
  summary: {
    sampleCount: 3000,
    average: 8,
    percents: { very_low: 3, low: 9, in_range: 70, high: 14, very_high: 4 },
    counts: { very_low: 90, low: 270, in_range: 2100, high: 420, very_high: 120 },
  },
  inRangePercent: 70,
  belowPercent: 12,
  abovePercent: 18,
  veryLowPercent: 3,
};

describe("FortnightRangeCard", () => {
  it("shows in range, below, and above, and calls out very low", () => {
    render(<FortnightRangeCard picture={picture} units="mmol/L" />);
    expect(screen.getByTestId("fortnight-in-range")).toHaveTextContent("70%");
    expect(screen.getByTestId("fortnight-below")).toHaveTextContent("12%");
    expect(screen.getByTestId("fortnight-below")).toHaveTextContent("Includes 3% very low");
    expect(screen.getByTestId("fortnight-above")).toHaveTextContent("18%");
    expect(screen.getByText(/Not a lab result/)).toBeTruthy();
  });
});
