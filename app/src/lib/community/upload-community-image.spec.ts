import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isTransientCommunityUploadError,
  uploadCommunityImageFile,
} from "./upload-community-image";

describe("uploadCommunityImageFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("treats Load failed and JWT blips as transient", () => {
    expect(isTransientCommunityUploadError("Load failed")).toBe(true);
    expect(isTransientCommunityUploadError("Failed to fetch")).toBe(true);
    expect(isTransientCommunityUploadError("Invalid JWT")).toBe(true);
    expect(isTransientCommunityUploadError("mime type not supported")).toBe(false);
  });

  it("uploads via XHR and retries once after Load failed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("Load failed"))
      .mockResolvedValueOnce({ status: 200, location: null, uploadOffset: null, text: "" });

    const supabase = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        })),
        refreshSession: vi.fn(async () => ({ data: { session: null } })),
      },
      storage: {
        from: vi.fn(),
      },
    };

    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
    await uploadCommunityImageFile(supabase as never, "user/post/0.jpg", file, {
      send: send as never,
      attempts: 3,
    });

    expect(send).toHaveBeenCalledTimes(2);
    const first = send.mock.calls[0]![0] as { url: string; headers: Record<string, string>; body: File };
    expect(first.url).toContain("/storage/v1/object/community_post_images/user/post/0.jpg");
    expect(first.headers["content-type"]).toBe("image/jpeg");
    expect(first.headers["x-upsert"]).toBe("false");
    expect(first.body).toBe(file);
    expect((send.mock.calls[1]![0] as { headers: Record<string, string> }).headers["x-upsert"]).toBe("true");
  });
});
