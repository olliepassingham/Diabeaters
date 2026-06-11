import { useCallback, useRef } from "react";

const DEFAULT_MAX_DELAY_MS = 300;
const CLICK_SUPPRESS_MS = 400;

/**
 * Reliable double-tap on touch devices (`dblclick` is unreliable in mobile WebViews).
 * Desktop: native double-click. Touch: two quick taps on the same target.
 */
export function useDoubleTap(onDoubleTap: () => void, maxDelayMs = DEFAULT_MAX_DELAY_MS) {
  const lastTapAtRef = useRef(0);
  const suppressClickUntilRef = useRef(0);
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length !== 1) return;

      const now = Date.now();
      if (now - lastTapAtRef.current <= maxDelayMs) {
        lastTapAtRef.current = 0;
        suppressClickUntilRef.current = now + CLICK_SUPPRESS_MS;
        e.preventDefault();
        onDoubleTapRef.current();
      } else {
        lastTapAtRef.current = now;
      }
    },
    [maxDelayMs],
  );

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleTapRef.current();
  }, []);

  /** Swallow stray clicks after a touch double-tap (e.g. image open on the second tap). */
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return { onTouchEnd, onDoubleClick, onClickCapture };
}
