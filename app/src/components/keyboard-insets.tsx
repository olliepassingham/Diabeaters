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

    let lockedFeedScroll: number | null = null;

    const update = () => {
      // When the keyboard opens, visualViewport.height shrinks.
      // `offsetTop` is how far iOS has panned the page. Fixed sheets use both
      // so they stay in the visible area instead of sliding off the top.
      const rawInset = window.innerHeight - vv.height - vv.offsetTop;
      const inset = Math.max(0, Math.round(rawInset));
      setCssVar("--keyboard-inset-bottom", `${inset}px`);
      setCssVar("--vv-height", `${Math.max(0, Math.round(vv.height))}px`);
      setCssVar("--vv-offset-top", `${Math.max(0, Math.round(vv.offsetTop))}px`);
      if (lockedFeedScroll != null) {
        const scroller = document.getElementById("app-scroll-main");
        if (scroller && scroller.scrollTop !== lockedFeedScroll) scroller.scrollTop = lockedFeedScroll;
      }
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    const onFocusIn = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      // The story composer is a fixed full-screen stage. Scrolling the focused
      // text into view shifts the photo under the keyboard.
      if (target.closest("[data-story-stage], [data-keyboard-sheet], [data-comment-composer]")) {
        if (target.closest("[data-comment-composer]")) {
          const scroller = document.getElementById("app-scroll-main");
          lockedFeedScroll = scroller?.scrollTop ?? 0;
          if (scroller) scroller.scrollTop = lockedFeedScroll;
        }
        return;
      }

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

    const onFocusOut = (ev: FocusEvent) => {
      const next = ev.relatedTarget;
      if (next instanceof Element && next.closest("[data-comment-composer]")) return;
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof Element && active.closest("[data-comment-composer]")) return;
        lockedFeedScroll = null;
      }, 160);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      setCssVar("--keyboard-inset-bottom", "0px");
      setCssVar("--vv-height", "");
      setCssVar("--vv-offset-top", "0px");
    };
  }, []);

  return null;
}

