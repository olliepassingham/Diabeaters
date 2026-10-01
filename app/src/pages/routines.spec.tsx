import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutinesContent } from "@/pages/routines";
import { storage } from "@/lib/storage";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("meal routine foods", () => {
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

  it("saves searched foods onto the routine and leaves the insulin dose as typed", () => {
    render(<RoutinesContent />);

    fireEvent.click(screen.getByTestId("button-add-routine"));
    fireEvent.change(screen.getByTestId("input-routine-name"), { target: { value: "Morning banana" } });
    fireEvent.change(screen.getByTestId("input-insulin-dose"), { target: { value: "5" } });
    fireEvent.click(screen.getByTestId("button-routine-build-foods"));

    fireEvent.change(screen.getByTestId("input-carb-food-search"), { target: { value: "banana" } });
    fireEvent.click(screen.getByTestId("button-add-carb-food-banana"));
    fireEvent.click(screen.getByTestId("button-use-carb-estimate"));

    expect((screen.getByTestId("input-carbs") as HTMLInputElement).value).toBe("27");
    expect((screen.getByTestId("input-insulin-dose") as HTMLInputElement).value).toBe("5");
    expect(screen.getByTestId("routine-carb-foods").textContent).toContain("Banana");
    expect((screen.getByTestId("input-meal-description") as HTMLTextAreaElement).value).toBe("Banana");

    fireEvent.click(screen.getByTestId("button-save-routine"));

    const saved = storage.getRoutines()[0];
    expect(saved?.carbEstimate).toBe(27);
    expect(saved?.carbFoods).toEqual([{ foodId: "banana", portionId: "regular", quantity: 1 }]);
    expect(saved?.insulinDose).toBe(5);
    expect(screen.getByTestId(`text-routine-name-${saved?.id}`).textContent).toBe("Morning banana");
    fireEvent.click(screen.getByTestId(`button-routine-pattern-${saved?.id}`));
    expect(screen.getByText("A typical shape for these foods, not a forecast of your glucose.")).not.toBeNull();
    expect(screen.getByTestId("meal-impact-pattern-label").textContent).toBe("Fast rise");
  });
});
