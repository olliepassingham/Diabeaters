import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrls = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    storage: {
      from: () => ({
        createSignedUrls,
        createSignedUrl: vi.fn(),
      }),
    },
  }),
}));

import { getPostMediaSignedUrls } from "./post-media-signed-urls";

describe("getPostMediaSignedUrls", () => {
  beforeEach(() => {
    createSignedUrls.mockReset();
  });

  it("waits for an in-flight sign instead of returning empty urls", async () => {
    let resolveSign: (value: {
      data: { path: string; signedUrl: string; error: string | null }[];
      error: null;
    }) => void = () => {};
    createSignedUrls.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSign = resolve;
        }),
    );

    const first = getPostMediaSignedUrls(["race/photo.jpg"]);
    const second = getPostMediaSignedUrls(["race/photo.jpg"]);
    resolveSign({
      data: [{ path: "race/photo.jpg", signedUrl: "https://cdn.example/photo.jpg", error: null }],
      error: null,
    });

    await expect(first).resolves.toEqual(["https://cdn.example/photo.jpg"]);
    await expect(second).resolves.toEqual(["https://cdn.example/photo.jpg"]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("keeps a signed url when the storage response path does not match the request", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: "different-key.jpg", signedUrl: "https://cdn.example/grid.jpg", error: null }],
      error: null,
    });

    await expect(getPostMediaSignedUrls(["grid/0.jpg"])).resolves.toEqual(["https://cdn.example/grid.jpg"]);
  });
});
