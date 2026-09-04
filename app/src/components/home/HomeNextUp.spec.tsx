import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeNextUp } from "./HomeNextUp";
import { storage } from "@/lib/storage";

describe("HomeNextUp", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-09-04T21:30:00"));
  });

  it("groups evening bedtime and upcoming trip under Next up", () => {
    storage.saveHolidayPrep({
      id: "prep-1",
      destination: "Wyoming",
      departureDate: "2030-09-06",
      returnDate: "2030-09-23",
      checklist: [],
      createdAt: new Date().toISOString(),
    });

    render(<HomeNextUp />);

    expect(screen.getByTestId("home-next-up")).not.toBeNull();
    expect(screen.getByTestId("home-bedtime-moment").textContent).toMatch(/Bedtime check/);
    expect(screen.getByTestId("home-bedtime-moment").textContent).toMatch(/Start/);
    expect(screen.getByTestId("home-travel-context").textContent).toMatch(/Wyoming/);
    expect(screen.getByTestId("home-travel-context").textContent).toMatch(/Departs in 2 days/);
  });

  it("renders nothing when there is no trip and it is midday", () => {
    vi.setSystemTime(new Date("2030-09-04T14:00:00"));
    render(<HomeNextUp />);
    expect(screen.queryByTestId("home-next-up")).toBeNull();
  });
});
