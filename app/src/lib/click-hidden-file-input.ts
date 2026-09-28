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

/** Unlock body pointer-events until the system picker is dismissed. */
export function armSystemPickerPointerUnlock(): void {
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
const PICKER_SETTLE_MS = 600;

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
  armSystemPickerPointerUnlock();
  const release = beginFilePickerHold();
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    input.removeEventListener("change", onChange);
    input.removeEventListener("cancel", onCancel);
    window.removeEventListener("focus", onFocus);
    release();
  };
  const onChange = () => finish();
  const onCancel = () => finish();
  const onFocus = () => finish();
  input.addEventListener("change", onChange);
  input.addEventListener("cancel", onCancel);
  window.setTimeout(() => {
    if (closed) return;
    window.addEventListener("focus", onFocus);
  }, 0);
}

/** Programmatic file-input click that keeps the first Photos tap working. */
export function clickHiddenFileInput(input: HTMLInputElement | null | undefined): void {
  if (!input || input.disabled) return;
  prepareFileInputForPicker(input);
  input.click();
}
