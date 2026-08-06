import { describe, expect, it, vi, afterEach } from "vitest";
import {
  historyBackWithViewTransition,
  navigateWithViewTransition,
  supportsViewTransition,
} from "./nav-view-transition";

afterEach(() => {
  vi.restoreAllMocks();
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  delete document.documentElement.dataset.navDirection;
});

describe("nav-view-transition", () => {
  it("supportsViewTransition is boolean", () => {
    expect(typeof supportsViewTransition()).toBe("boolean");
  });

  it("falls back to setLocation when startViewTransition is missing", () => {
    const setLocation = vi.fn();
    navigateWithViewTransition(setLocation, "/tools");
    expect(setLocation).toHaveBeenCalledWith("/tools");
  });

  it("uses startViewTransition when available and motion is allowed", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      if (query === "(prefers-reduced-motion: reduce)") {
        return { matches: false } as MediaQueryList;
      }
      return { matches: false } as MediaQueryList;
    });
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (document as unknown as { startViewTransition: typeof startViewTransition }).startViewTransition =
      startViewTransition;

    const setLocation = vi.fn();
    navigateWithViewTransition(setLocation, "/account");

    expect(startViewTransition).toHaveBeenCalled();
    expect(setLocation).toHaveBeenCalledWith("/account");
  });

  it("marks back direction and replace when requested", () => {
    const setLocation = vi.fn();
    navigateWithViewTransition(setLocation, "/tools", { replace: true, direction: "back" });
    expect(document.documentElement.dataset.navDirection).toBe("back");
    expect(setLocation).toHaveBeenCalledWith("/tools", { replace: true });
  });

  it("historyBackWithViewTransition calls history.back", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    historyBackWithViewTransition();
    expect(back).toHaveBeenCalled();
    expect(document.documentElement.dataset.navDirection).toBe("back");
  });
});
