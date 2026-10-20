import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeStickyGlucoseBar } from "@/components/home/HomeStickyGlucoseBar";

describe("HomeStickyGlucoseBar", () => {
  it("renders nothing without a live reading", () => {
    const { container } = render(<HomeStickyGlucoseBar glucose={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the current value and links to glucose trends", () => {
    render(<HomeStickyGlucoseBar glucose={{ value: 6.7, units: "mmol/L", trend: "flat" }} />);
    const pill = screen.getByTestId("home-sticky-glucose");
    expect(pill.textContent).toContain("6.7");
    expect(pill.textContent).toContain("mmol/L");
    expect(pill.getAttribute("href")).toBe("/tools/cgm-live");
    expect(pill.getAttribute("data-visible")).toBe("false");
  });

  it("appears after the main scroller passes the hero", () => {
    const scroller = document.createElement("div");
    scroller.id = "app-scroll-main";
    document.body.appendChild(scroller);
    try {
      render(<HomeStickyGlucoseBar glucose={{ value: 6.7, units: "mmol/L", trend: "flat" }} />);
      scroller.scrollTop = 300;
      fireEvent.scroll(scroller);
      expect(screen.getByTestId("home-sticky-glucose").getAttribute("data-visible")).toBe("true");
    } finally {
      scroller.remove();
    }
  });
});
