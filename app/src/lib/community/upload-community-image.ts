import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseUrlAndAnonKey } from "@/lib/supabase";
import { explainImageUploadError } from "@/lib/community/prepare-post-image";
import { storageObjectUploadUrl, xhrUpload } from "@/lib/community/upload-feed-video";

const COMMUNITY_POST_IMAGES_BUCKET = "community_post_images";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageUploadErrorText(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as { message?: string; error?: string; msg?: string };
    return body.message || body.error || body.msg || `Upload failed (${status})`;
  } catch {
    return text.trim() || `Upload failed (${status})`;
  }
}

export function isTransientCommunityUploadError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("load failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("timed out") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    lower.includes("resource already exists") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized")
  );
}

function contentTypeForImageUpload(file: File): string {
  const n = (file.name || "").toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (n.endsWith(".png") || t === "image/png") return "image/png";
  if (n.endsWith(".webp") || t === "image/webp") return "image/webp";
  if (n.endsWith(".gif") || t === "image/gif") return "image/gif";
  if (t.startsWith("image/") && t !== "image/jpeg" && t !== "image/jpg") return t;
  return "image/jpeg";
}

async function resolveFreshAccessToken(supabase: SupabaseClient): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token ?? "";
  const expiresAt = sessionData.session?.expires_at;
  const expiringSoon = typeof expiresAt === "number" && expiresAt * 1000 < Date.now() + 90_000;
  if (!token || expiringSoon) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token ?? token;
  }
  return token;
}

export type UploadCommunityImageOptions = {
  /** Max attempts (default 3). */
  attempts?: number;
  /** Optional inject for tests. */
  send?: typeof xhrUpload;
};

/**
 * Upload a community image (feed / story / DM / comment) via XHR with retries.
 * Avoids supabase.storage.upload → fetch(), which iPhone aborts for camera-roll Files.
 */
export async function uploadCommunityImageFile(
  supabase: SupabaseClient,
  path: string,
  file: File,
  options?: UploadCommunityImageOptions,
): Promise<void> {
  const contentType = contentTypeForImageUpload(file);
  const env = getSupabaseUrlAndAnonKey();
  const maxAttempts = options?.attempts ?? 3;
  const send = options?.send ?? xhrUpload;
  let lastMessage = "Upload failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const upsert = attempt > 0;
    try {
      const accessToken = await resolveFreshAccessToken(supabase);
      if (env && accessToken) {
        const response = await send({
          url: storageObjectUploadUrl(env.url, path),
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            apikey: env.anonKey,
            "x-upsert": String(upsert),
            "cache-control": "max-age=604800",
            "content-type": contentType,
          },
          body: file,
        });
        if (response.status >= 200 && response.status < 300) return;
        lastMessage = storageUploadErrorText(response.status, response.text);
      } else {
        const { error } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).upload(path, file, {
          cacheControl: "604800",
          upsert,
          contentType,
        });
        if (!error) return;
        lastMessage = error.message || lastMessage;
      }
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : lastMessage;
    }

    if (attempt < maxAttempts - 1 && isTransientCommunityUploadError(lastMessage)) {
      await sleep(450 * (attempt + 1));
      continue;
    }
    break;
  }

  throw new Error(explainImageUploadError(lastMessage));
}
