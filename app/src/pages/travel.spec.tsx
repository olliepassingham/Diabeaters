import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Travel from "./travel";
import { storage } from "@/lib/storage";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com" } as import("@supabase/supabase-js").User }),
}));

vi.mock("@/lib/appointments-supabase", () => ({
  syncAppointments: vi.fn(async () => undefined),
}));

describe("Travel page", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders an empty travel landing with one clear plan action", () => {
    render(<Travel />);
    expect(screen.queryByTestId("travel-empty-hero")).not.toBeNull();
    expect(screen.queryByTestId("button-start-travel-plan")).not.toBeNull();
    expect(screen.queryByTestId("alert-when-to-start-travel")).toBeNull();
    expect(screen.queryByTestId("button-start-holiday-prep")).toBeNull();
  });

  it("opens on Your trip when a plan draft has destination dates", () => {
    storage.saveTravelWizardDraft({
      step: "results",
      plan: {
        duration: 5,
        destination: "Spain",
        travelType: "international",
        timezoneChange: "none",
        timezoneHours: 0,
        timezoneDirection: "east",
        startDate: "2030-06-01",
        endDate: "2030-06-05",
        accessRisk: "easy",
        weatherChange: "same",
        weatherSeverity: "mild",
        tripStyle: "relaxed",
      },
      packingList: [
        {
          name: "Fast-acting insulin",
          category: "insulin",
          estimatedAmount: 2,
          unit: "pens",
          checked: false,
          reasoning: "test",
        },
      ],
      resultsTab: "packing",
      savedAt: new Date().toISOString(),
    });

    render(<Travel />);
    expect(screen.queryByTestId("card-travel-entry-hub")).not.toBeNull();
    expect(screen.queryByText("Your trip")).not.toBeNull();
    expect(screen.queryByText("Spain")).not.toBeNull();
  });

  it("shows concrete supply days needed on the trip card", () => {
    storage.saveHolidayPrep({
      id: "prep-1",
      destination: "Wyoming",
      departureDate: "2030-09-05",
      returnDate: "2030-09-23",
      checklist: [],
      createdAt: new Date().toISOString(),
    });
    storage.addSupply({
      name: "Insulin pens",
      type: "insulin",
      currentQuantity: 200,
      dailyUsage: 4,
      lastPickupDate: new Date().toISOString(),
      notes: undefined,
    });

    render(<Travel />);
    const summary = screen.queryByTestId("link-travel-supply-summary");
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toMatch(/Need \d+ days of supplies/);
    expect(summary?.textContent).toMatch(/18-day trip \+ buffer/);
    expect(screen.queryByText("Supplies look covered for this trip")).toBeNull();
  });

  it("lets you edit upcoming trip destination and dates", () => {
    storage.saveHolidayPrep({
      id: "prep-edit",
      destination: "wyoming",
      departureDate: "2030-09-05",
      returnDate: "2030-09-23",
      checklist: [],
      createdAt: new Date().toISOString(),
    });

    render(<Travel />);
    fireEvent.click(screen.getByTestId("button-edit-holiday-prep"));
    expect(screen.getByTestId("dialog-edit-trip-details")).not.toBeNull();

    fireEvent.change(screen.getByTestId("input-edit-trip-destination"), {
      target: { value: "Wyoming, USA" },
    });
    fireEvent.change(screen.getByTestId("input-edit-trip-return"), {
      target: { value: "2030-09-20" },
    });
    fireEvent.click(screen.getByTestId("button-save-edit-trip"));

    expect(screen.queryByText("Wyoming, USA")).not.toBeNull();
    expect(screen.getByTestId("card-travel-entry-hub").textContent).toMatch(/15d/);
    expect(storage.getHolidayPrep()?.destination).toBe("Wyoming, USA");
    expect(storage.getHolidayPrep()?.returnDate).toBe("2030-09-20");
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
