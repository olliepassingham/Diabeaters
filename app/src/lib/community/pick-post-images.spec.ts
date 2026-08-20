import { describe, expect, it } from "vitest";
import { filesFromImageInput, isLikelyImageFile } from "@/lib/community/pick-post-images";

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("isLikelyImageFile", () => {
  it("accepts image/* MIME types", () => {
    expect(isLikelyImageFile(makeFile("a.jpg", "image/jpeg"))).toBe(true);
  });

  it("rejects clearly non-image types", () => {
    expect(isLikelyImageFile(makeFile("a.txt", "text/plain"))).toBe(false);
  });

  it("accepts empty MIME and octet-stream for photo-like names", () => {
    expect(isLikelyImageFile(makeFile("IMG_001.HEIC", "application/octet-stream"))).toBe(true);
    expect(isLikelyImageFile(makeFile("photo.jpg", ""))).toBe(true);
    expect(isLikelyImageFile(makeFile("content", ""))).toBe(true);
  });
});

describe("filesFromImageInput", () => {
  it("returns only image files up to the remaining cap", () => {
    const list = {
      length: 3,
      0: makeFile("a.jpg", "image/jpeg"),
      1: makeFile("b.txt", "text/plain"),
      2: makeFile("c.png", "image/png"),
    } as FileList;

    const picked = filesFromImageInput(list, 2);
    expect(picked).toHaveLength(2);
    expect(picked.map((f) => f.name)).toEqual(["a.jpg", "c.png"]);
  });

  it("keeps Android/iOS picks with empty MIME or octet-stream", () => {
    const list = {
      length: 2,
      0: makeFile("IMG_001.HEIC", "application/octet-stream"),
      1: makeFile("content", ""),
    } as FileList;

    const picked = filesFromImageInput(list, 0);
    expect(picked.map((f) => f.name)).toEqual(["IMG_001.HEIC", "content"]);
  });

  it("returns empty when at the image cap", () => {
    const list = {
      length: 1,
      0: makeFile("a.jpg", "image/jpeg"),
    } as FileList;

    expect(filesFromImageInput(list, 4)).toEqual([]);
  });
});
