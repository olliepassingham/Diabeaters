import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Travel from "./travel";
import { storage } from "@/lib/storage";

describe("Travel page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders entry step without crashing", () => {
    render(<Travel />);
    expect(screen.queryByTestId("button-start-travel-plan")).not.toBeNull();
  });

  it("renders active travel dashboard without crashing", () => {
    const today = new Date();
    const start = today.toISOString().split("T")[0];
    const end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const plan = {
      duration: 7,
      destination: "Spain",
      travelType: "international" as const,
      timezoneChange: "minor" as const,
      timezoneHours: 1,
      timezoneDirection: "east" as const,
      startDate: start,
      endDate: end,
      accessRisk: "easy" as const,
      weatherChange: "warmer" as const,
      weatherSeverity: "moderate" as const,
      tripStyle: "active" as const,
    };
    storage.activateTravelMode("Spain", start, end, 1, "east");
    storage.saveTravelPlan(plan);
    storage.saveTravelPackingList([
      {
        name: "Fast-acting insulin",
        category: "insulin",
        estimatedAmount: 2,
        unit: "pens",
        checked: false,
        reasoning: "test",
      },
    ]);

    render(<Travel />);
    expect(screen.queryByTestId("travel-active-header")).not.toBeNull();
  });
});
