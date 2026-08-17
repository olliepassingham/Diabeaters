/**
 * Hidden file control that iOS Photos still accepts.
 * `hidden` / `sr-only` (clip + 1px box) makes the first tap on a thumbnail miss.
 */
export const FILE_INPUT_HIDDEN_CLASS =
  "pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0";

type PointerSnapshot = {
  el: HTMLElement;
  value: string;
  priority: string;
};

/**
 * Radix/Vaul set `pointer-events: none` on body while a sheet is open. iOS then
 * swallows the first tap inside the system photo picker. Unlock until the picker
 * is gone (native plugin await, or window focus after a file input).
 */
export function unlockSystemPickerPointerEvents(): () => void {
  if (typeof document === "undefined") return () => {};

  const nodes = [document.documentElement, document.body, document.getElementById("root")].filter(
    (el): el is HTMLElement => el != null,
  );

  const prev: PointerSnapshot[] = nodes.map((el) => ({
    el,
    value: el.style.getPropertyValue("pointer-events"),
    priority: el.style.getPropertyPriority("pointer-events"),
  }));

  for (const { el } of prev) {
    el.style.setProperty("pointer-events", "auto", "important");
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const p of prev) {
      if (p.value) p.el.style.setProperty("pointer-events", p.value, p.priority || undefined);
      else p.el.style.removeProperty("pointer-events");
    }
  };
}

/** Programmatic file-input click that keeps the first Photos tap working. */
export function clickHiddenFileInput(input: HTMLInputElement | null | undefined): void {
  if (!input || input.disabled) return;
  const restore = unlockSystemPickerPointerEvents();
  const finish = () => {
    window.removeEventListener("focus", finish);
    document.removeEventListener("visibilitychange", onVis);
    window.setTimeout(restore, 400);
  };
  const onVis = () => {
    if (document.visibilityState === "visible") finish();
  };
  window.addEventListener("focus", finish);
  document.addEventListener("visibilitychange", onVis);
  input.click();
}
