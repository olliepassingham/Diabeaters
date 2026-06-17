import { describe, expect, it } from "vitest";
import { filesFromImageInput } from "@/lib/community/pick-post-images";

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

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

  it("returns empty when at the image cap", () => {
    const list = {
      length: 1,
      0: makeFile("a.jpg", "image/jpeg"),
    } as FileList;

    expect(filesFromImageInput(list, 4)).toEqual([]);
  });
});
