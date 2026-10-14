import { describe, expect, it, vi } from "vitest";

import {
  copyVideoFileForUpload,
  explainVideoUploadError,
  feedVideoStorageExt,
  fileForFeedVideoUpload,
  resumableUploadFeedVideo,
  tusUploadMetadata,
} from "@/lib/community/upload-feed-video";

describe("feed video upload", () => {
  it("stores iPhone QuickTime clips as mp4 and leaves webm alone", () => {
    const mov = new File([new Uint8Array([1, 2, 3])], "IMG_1234.MOV", { type: "video/quicktime" });
    const prepared = fileForFeedVideoUpload(mov);
    expect(feedVideoStorageExt(mov)).toBe("mp4");
    expect(prepared.type).toBe("video/mp4");
    expect(prepared.name.endsWith(".mp4")).toBe(true);

    const webm = new File([new Uint8Array([1])], "clip.webm", { type: "video/webm" });
    expect(fileForFeedVideoUpload(webm).type).toBe("video/webm");
    expect(feedVideoStorageExt(webm)).toBe("webm");
  });

  it("copies camera-roll bytes so the upload does not depend on the file input", async () => {
    const original = new File([new Uint8Array([9, 8, 7, 6])], "clip.mov", { type: "video/quicktime" });
    const copied = await copyVideoFileForUpload(original);
    expect(copied.file).not.toBe(original);
    expect(copied.file.type).toBe("video/mp4");
    expect(copied.file.name.endsWith(".mp4")).toBe(true);
    if (copied.ownsBytes) expect(copied.file.size).toBe(original.size);
  });

  it("turns storage size and network failures into a clear reason", () => {
    expect(explainVideoUploadError("The object exceeded the maximum allowed size")).toMatch(/shorter clip/);
    expect(explainVideoUploadError("Failed to fetch")).toMatch(/stopped before it finished/);
    expect(explainVideoUploadError("mime type video/quicktime is not supported")).toMatch(/video format/);
  });

  it("uploads a clip in resumable chunks", async () => {
    const file = new File([new Uint8Array(8)], "clip.mp4", { type: "video/mp4" });
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(String(init.headers && (init.headers as Record<string, string>)["upload-length"])).toBe("8");
        expect(tusUploadMetadata({ bucketName: "community_post_images", objectName: "u/p/video.mp4" })).toContain(
          "bucketName",
        );
        return new Response(null, { status: 201, headers: { location: "https://example.test/upload/1" } });
      }
      expect(url).toBe("https://example.test/upload/1");
      expect(init?.body).toBeInstanceOf(Blob);
      return new Response(null, { status: 204, headers: { "upload-offset": "8" } });
    });

    await resumableUploadFeedVideo({
      endpoint: "https://example.test/storage/v1/upload/resumable",
      file,
      bucket: "community_post_images",
      objectName: "u/p/video.mp4",
      contentType: "video/mp4",
      accessToken: "token",
      anonKey: "anon",
      upsert: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
