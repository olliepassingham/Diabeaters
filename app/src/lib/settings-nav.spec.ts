import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { scrollAppMainToTop, SETTINGS_DATE_OF_BIRTH_HREF } from "./settings-nav";

describe("SETTINGS_DATE_OF_BIRTH_HREF", () => {
  it("points at personal usage settings with dob anchor", () => {
    expect(SETTINGS_DATE_OF_BIRTH_HREF).toBe("/settings/usage#settings-dob");
  });
});

describe("scrollAppMainToTop", () => {
  let main: HTMLDivElement;

  beforeEach(() => {
    main = document.createElement("div");
    main.id = "app-scroll-main";
    Object.defineProperty(main, "scrollTo", {
      value: (opts: ScrollToOptions) => {
        main.scrollTop = opts.top ?? 0;
        main.scrollLeft = opts.left ?? 0;
      },
      configurable: true,
    });
    main.scrollTop = 240;
    document.body.appendChild(main);
  });

  afterEach(() => {
    main.remove();
  });

  it("scrolls the app main container to the top", () => {
    scrollAppMainToTop("auto");
    expect(main.scrollTop).toBe(0);
  });
});
