import { afterEach, describe, expect, it, vi } from "vitest";
import { blobFromNativeMediaUrl } from "./pick-story-video";

describe("blobFromNativeMediaUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads camera-roll URLs via XHR when fetch would fail", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const blob = new Blob([bytes], { type: "image/jpeg" });

    class FakeXHR {
      responseType = "";
      status = 200;
      response: Blob | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      open() {}
      send() {
        this.response = blob;
        this.onload?.();
      }
    }

    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Load failed");
      }),
    );

    const result = await blobFromNativeMediaUrl("capacitor://localhost/_capacitor_file_/photo.jpg");
    expect(result).toBeTruthy();
    expect(result?.size).toBe(4);
    expect(fetch).not.toHaveBeenCalled();
  });
});
