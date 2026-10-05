import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clickHiddenFileInput,
  isFilePickerActive,
  PICKER_SETTLE_MS,
  unlockSystemPickerPointerEvents,
} from "./click-hidden-file-input";

describe("unlockSystemPickerPointerEvents", () => {
  afterEach(() => {
    document.body.style.removeProperty("pointer-events");
    document.documentElement.style.removeProperty("pointer-events");
  });

  it("overrides a locked body so the system picker can receive the first tap", () => {
    document.body.style.setProperty("pointer-events", "none");
    const restore = unlockSystemPickerPointerEvents();
    expect(document.body.style.getPropertyValue("pointer-events")).toBe("auto");
    restore();
    expect(document.body.style.getPropertyValue("pointer-events")).toBe("none");
  });
});

describe("clickHiddenFileInput", () => {
  afterEach(() => {
    document.body.style.removeProperty("pointer-events");
    document.documentElement.style.removeProperty("pointer-events");
    vi.useRealTimers();
  });

  it("clicks the input after unlocking pointer events", () => {
    vi.useFakeTimers();
    document.body.style.setProperty("pointer-events", "none");
    const input = document.createElement("input");
    input.type = "file";
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    clickHiddenFileInput(input);
    expect(document.body.style.getPropertyValue("pointer-events")).toBe("auto");
    expect(click).toHaveBeenCalledTimes(1);
    input.dispatchEvent(new Event("cancel"));
    expect(isFilePickerActive()).toBe(true);
    vi.advanceTimersByTime(PICKER_SETTLE_MS);
    expect(isFilePickerActive()).toBe(false);
    click.mockRestore();
  });

  it("holds the sheet open until the file selection finishes", () => {
    vi.useFakeTimers();
    const input = document.createElement("input");
    input.type = "file";
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    clickHiddenFileInput(input);
    expect(isFilePickerActive()).toBe(true);
    input.dispatchEvent(new Event("change"));
    expect(isFilePickerActive()).toBe(true);
    vi.advanceTimersByTime(PICKER_SETTLE_MS - 1);
    expect(isFilePickerActive()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isFilePickerActive()).toBe(false);
    click.mockRestore();
  });

  it("ignores focus churn while the picker is still opening", () => {
    vi.useFakeTimers();
    const input = document.createElement("input");
    input.type = "file";
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    clickHiddenFileInput(input);
    expect(isFilePickerActive()).toBe(true);

    // Immediate focus (common when the OS picker opens) must not end the hold.
    vi.advanceTimersByTime(500);
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(200);
    expect(isFilePickerActive()).toBe(true);

    // Selection still works after the noise.
    input.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(PICKER_SETTLE_MS);
    expect(isFilePickerActive()).toBe(false);
    click.mockRestore();
  });

  it("does nothing when the input is disabled", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.disabled = true;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    clickHiddenFileInput(input);
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
});
