import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupporterHomeCardsSheet } from "./supporter-home-cards-sheet";

describe("SupporterHomeCardsSheet", () => {
  beforeEach(() => {
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
  it("hides a quiet card from the switch", () => {
    const onShownChange = vi.fn();
    render(
      <SupporterHomeCardsSheet
        open
        onOpenChange={() => {}}
        onShownChange={onShownChange}
        cards={[
          {
            id: "appointments",
            label: "Appointments",
            detail: "",
            shown: true,
            locked: false,
          },
        ]}
      />,
    );

    expect(screen.getByText(/alerts stay visible/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId("switch-supporter-card-appointments"));
    expect(onShownChange).toHaveBeenCalledWith("appointments", false);
  });

  it("keeps a pinned card on", () => {
    const onShownChange = vi.fn();
    render(
      <SupporterHomeCardsSheet
        open
        onOpenChange={() => {}}
        onShownChange={onShownChange}
        cards={[
          {
            id: "supplies",
            label: "Supplies",
            detail: "Low stock",
            shown: true,
            locked: true,
          },
        ]}
      />,
    );

    const toggle = screen.getByTestId("switch-supporter-card-supplies");
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onShownChange).not.toHaveBeenCalled();
  });
});
