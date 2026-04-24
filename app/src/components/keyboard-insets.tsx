import { useEffect } from "react";

function setCssVar(name: string, value: string) {
  try {
    document.documentElement.style.setProperty(name, value);
    document.body?.style?.setProperty(name, value);
    document.getElementById("root")?.style?.setProperty(name, value);
  } catch {
    // no-op (SSR / early init)
  }
}

/**
 * iOS keyboard + safe-area helper.
 *
 * - Exposes `--keyboard-inset-bottom` so fixed/sticky footers can lift above the keyboard.
 * - Nudges focused inputs into view when the keyboard is open.
 */
export function KeyboardInsets() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) {
      setCssVar("--keyboard-inset-bottom", "0px");
      return;
    }

    const update = () => {
      // When the keyboard opens, visualViewport.height shrinks.
      // `offsetTop` accounts for iOS “rubber band” / address-bar shifts.
      const rawInset = window.innerHeight - vv.height - vv.offsetTop;
      const inset = Math.max(0, Math.round(rawInset));
      setCssVar("--keyboard-inset-bottom", `${inset}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    const onFocusIn = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      // Only help on iOS-style keyboard open; otherwise avoid annoying jumps.
      const insetPx = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset-bottom") || "0",
        10,
      );
      if (!Number.isFinite(insetPx) || insetPx <= 0) return;

      if (typeof target.scrollIntoView !== "function") return;
      window.setTimeout(() => {
        try {
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        } catch {
          // ignore
        }
      }, 60);
    };

    document.addEventListener("focusin", onFocusIn);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      document.removeEventListener("focusin", onFocusIn);
      setCssVar("--keyboard-inset-bottom", "0px");
    };
  }, []);

  return null;
}

