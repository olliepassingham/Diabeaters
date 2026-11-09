import "@testing-library/jest-dom/vitest";
import "@testing-library/jest-dom/vitest";
import * as jestDomMatchers from "@testing-library/jest-dom/matchers";

import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";

// Register on this file's `expect` — the side-effect `jest-dom/vitest` import can bind to a second vitest copy.
expect.extend(jestDomMatchers);

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

afterEach(() => {
  cleanup();
});
