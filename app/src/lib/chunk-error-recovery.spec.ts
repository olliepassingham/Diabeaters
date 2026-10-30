import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearChunkRecoveryAttempted,
  isLazyChunkLoadError,
  markChunkRecoveryAttempted,
  shouldReloadAfterChunkError,
} from "./chunk-error-recovery";
import * as offline from "./offline";

describe("chunk error recovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("detects lazy chunk load failures", () => {
    expect(isLazyChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isLazyChunkLoadError(new Error("Load failed"))).toBe(true);
    expect(isLazyChunkLoadError(new Error("boom"))).toBe(false);
  });

  it("does not auto-reload chunk errors when offline", () => {
    vi.spyOn(offline, "isOnline").mockReturnValue(false);
    const err = new Error("Failed to fetch dynamically imported module");
    expect(shouldReloadAfterChunkError(err)).toBe(false);
  });

  it("auto-reloads chunk errors once when online", () => {
    vi.spyOn(offline, "isOnline").mockReturnValue(true);
    const err = new Error("Failed to fetch dynamically imported module");
    expect(shouldReloadAfterChunkError(err)).toBe(true);
    markChunkRecoveryAttempted();
    expect(shouldReloadAfterChunkError(err)).toBe(false);
    clearChunkRecoveryAttempted();
    expect(shouldReloadAfterChunkError(err)).toBe(true);
  });
});
