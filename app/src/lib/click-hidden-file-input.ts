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
 * is gone (native plugin await, or a real return from the OS picker).
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

/**
 * Unlock body pointer-events until the system picker is actually dismissed.
 *
 * Do not restore on the first `focus` event — phones often fire focus/blur while
 * the picker is opening, which used to re-lock the page and swallow the first
 * thumbnail tap (so attaching took two tries).
 */
export function armSystemPickerPointerUnlock(): () => void {
  const restore = unlockSystemPickerPointerEvents();
  let closed = false;
  let sawHide = false;
  let focusTimer: number | null = null;
  const openedAt = Date.now();

  const finish = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
    if (focusTimer != null) window.clearTimeout(focusTimer);
    window.setTimeout(restore, 400);
  };

  const onVis = () => {
    if (document.visibilityState === "hidden") {
      sawHide = true;
      return;
    }
    if (sawHide) finish();
  };

  const onFocus = () => {
    // Ignore focus churn while the picker is still opening.
    if (Date.now() - openedAt < 700) return;
    if (focusTimer != null) window.clearTimeout(focusTimer);
    // Give `change` a moment to win if the user selected a file.
    focusTimer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      finish();
    }, 350);
  };

  document.addEventListener("visibilitychange", onVis);
  window.setTimeout(() => {
    if (closed) return;
    window.addEventListener("focus", onFocus);
  }, 500);

  return finish;
}

/**
 * Sheets dismiss when the OS file dialog opens, which drops the selection before
 * `change` fires. Hold them open until the picker finishes.
 */
let filePickerHold = 0;
const filePickerListeners = new Set<() => void>();

function emitFilePickerHold() {
  filePickerListeners.forEach((listener) => listener());
}

export function isFilePickerActive(): boolean {
  return filePickerHold > 0;
}

export function subscribeFilePickerActive(listener: () => void): () => void {
  filePickerListeners.add(listener);
  return () => filePickerListeners.delete(listener);
}

function retainFilePicker(): () => void {
  filePickerHold += 1;
  emitFilePickerHold();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    filePickerHold = Math.max(0, filePickerHold - 1);
    emitFilePickerHold();
  };
}

/** How long to keep the sheet from dismissing after the OS picker closes. */
export const PICKER_SETTLE_MS = 1000;

/**
 * Hold surrounding sheets open for a system picker, and for a short beat after it
 * closes. The close often lands as a tap on the sheet overlay and would wipe a
 * selection that just arrived.
 */
export function beginFilePickerHold(): () => void {
  const release = retainFilePicker();
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    window.setTimeout(release, PICKER_SETTLE_MS);
  };
}

/** Arm pointer-events and keep the surrounding sheet open for this input's picker. */
export function prepareFileInputForPicker(input: HTMLInputElement | null | undefined): void {
  if (!input || input.disabled) return;
  const restorePointer = unlockSystemPickerPointerEvents();
  const releaseHold = beginFilePickerHold();
  let closed = false;
  let sawHide = false;
  let focusTimer: number | null = null;
  const openedAt = Date.now();

  const finish = () => {
    if (closed) return;
    closed = true;
    input.removeEventListener("change", onChange);
    input.removeEventListener("cancel", onCancel);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
    if (focusTimer != null) window.clearTimeout(focusTimer);
    window.setTimeout(restorePointer, 400);
    releaseHold();
  };

  const onChange = () => finish();
  const onCancel = () => finish();
  const onVis = () => {
    if (document.visibilityState === "hidden") {
      sawHide = true;
      return;
    }
    if (sawHide) finish();
  };
  const onFocus = () => {
    // Ignore the blur/focus noise phones fire while the picker is still opening.
    if (Date.now() - openedAt < 700) return;
    if (focusTimer != null) window.clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      finish();
    }, 350);
  };

  input.addEventListener("change", onChange);
  input.addEventListener("cancel", onCancel);
  document.addEventListener("visibilitychange", onVis);
  window.setTimeout(() => {
    if (closed) return;
    window.addEventListener("focus", onFocus);
  }, 500);
}

/** Programmatic file-input click that keeps the first Photos tap working. */
export function clickHiddenFileInput(input: HTMLInputElement | null | undefined): void {
  if (!input || input.disabled) return;
  prepareFileInputForPicker(input);
  input.click();
}
