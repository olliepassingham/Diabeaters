import { describe, expect, it } from "vitest";
import {
  explainImageUploadError,
  isHeicLikeImage,
  shouldReencodePostImage,
} from "./prepare-post-image";

function fakeFile(name: string, type: string, size: number): File {
  const bytes = new Uint8Array(Math.min(size, 64));
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("prepare-post-image helpers", () => {
  it("detects HEIC camera-roll files even with empty MIME", () => {
    expect(isHeicLikeImage(fakeFile("IMG_001.HEIC", "", 1_000_000))).toBe(true);
    expect(isHeicLikeImage(fakeFile("photo.jpg", "image/jpeg", 1_000_000))).toBe(false);
  });

  it("re-encodes HEIC, odd MIME, and large files", () => {
    expect(shouldReencodePostImage(fakeFile("a.heic", "image/heic", 500_000))).toBe(true);
    expect(shouldReencodePostImage(fakeFile("a.bin", "application/octet-stream", 500_000))).toBe(true);
    expect(shouldReencodePostImage(fakeFile("a.jpg", "image/jpeg", 3_500_000))).toBe(true);
    expect(shouldReencodePostImage(fakeFile("a.jpg", "image/jpeg", 400_000))).toBe(false);
  });

  it("explains MIME and HEIC failures in plain language", () => {
    expect(explainImageUploadError("mime type image/heic is not supported").toLowerCase()).toMatch(
      /rejected|compatible|format/,
    );
    expect(explainImageUploadError("Could not read image").toLowerCase()).toMatch(/iphone|compatible|convert/);
  });
});
