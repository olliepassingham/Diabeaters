import { getSupabase } from "@/lib/supabase";

const COMMUNITY_POST_IMAGES_BUCKET = "community_post_images";

const SIGNED_URL_SECONDS = 3600;
/** Refresh before the storage token expires. */
const CACHE_TTL_MS = 50 * 60 * 1000;
const SIGN_CHUNK_SIZE = 40;

type CacheEntry = { url: string; expiresAt: number };

const urlCache = new Map<string, CacheEntry>();
/** In-flight sign jobs. Later callers await these instead of returning empty URLs. */
const inflight = new Map<string, Promise<void>>();

function normalizePath(path: string): string {
  return String(path ?? "").trim();
}

/** Local preview URLs are already displayable. They are not storage paths. */
function isDirectMediaUrl(path: string): boolean {
  return path.startsWith("blob:") || path.startsWith("data:");
}

function readCache(path: string): string | null {
  const entry = urlCache.get(path);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    urlCache.delete(path);
    return null;
  }
  return entry.url;
}

function writeCache(path: string, url: string): void {
  urlCache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Synchronous read for instant paint when URLs were prefetched or recently viewed. */
export function getCachedPostMediaSignedUrl(path: string): string | null {
  const trimmed = normalizePath(path);
  if (!trimmed) return null;
  if (isDirectMediaUrl(trimmed)) return trimmed;
  return readCache(trimmed);
}

function preloadImage(url: string): void {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

const warmedVideoUrls = new Set<string>();

function preloadVideo(url: string): void {
  if (warmedVideoUrls.has(url)) return;
  warmedVideoUrls.add(url);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  video.load();
}

function isVideoPath(path: string, kind?: string | null): boolean {
  if ((kind || "").toLowerCase() === "video") return true;
  return /\.(mp4|mov|webm)$/i.test(path);
}

async function signChunk(paths: string[]): Promise<Map<string, string | null>> {
  const supabase = getSupabase();
  const out = new Map<string, string | null>();
  if (!supabase || paths.length === 0) return out;

  const storage = supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET);
  const batchApi = storage as {
    createSignedUrls?: (p: string[], expiresIn: number) => Promise<{
      data: { path: string; signedUrl: string; error: string | null }[] | null;
      error: { message: string } | null;
    }>;
  };

  if (typeof batchApi.createSignedUrls === "function") {
    const { data, error } = await batchApi.createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (!error && data) {
      const byReturnedPath = data.length === paths.length && data.every((item) => paths.includes(item.path));
      if (byReturnedPath) {
        for (const item of data) {
          out.set(item.path, item.error ? null : item.signedUrl || null);
        }
      } else if (data.length === paths.length) {
        paths.forEach((path, i) => {
          const item = data[i];
          out.set(path, item?.error ? null : item?.signedUrl || null);
        });
      } else {
        for (const item of data) {
          if (!paths.includes(item.path)) continue;
          out.set(item.path, item.error ? null : item.signedUrl || null);
        }
      }
      if (out.size === paths.length) return out;
    }
  }

  await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await storage.createSignedUrl(path, SIGNED_URL_SECONDS);
      out.set(path, !error && data?.signedUrl ? data.signedUrl : null);
    }),
  );
  return out;
}

async function signMissingPaths(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.map(normalizePath).filter((path) => path && !isDirectMediaUrl(path)))];
  const missing = unique.filter((p) => !readCache(p) && !inflight.has(p));

  if (missing.length > 0) {
    let finish!: () => void;
    const job = new Promise<void>((resolve) => {
      finish = resolve;
    });
    for (const p of missing) inflight.set(p, job);

    void (async () => {
      try {
        for (let i = 0; i < missing.length; i += SIGN_CHUNK_SIZE) {
          const chunk = missing.slice(i, i + SIGN_CHUNK_SIZE);
          const signed = await signChunk(chunk);
          for (const path of chunk) {
            const url = signed.get(path);
            if (url) writeCache(path, url);
          }
        }
      } finally {
        for (const p of missing) inflight.delete(p);
        finish();
      }
    })();
  }

  const pending = unique.map((p) => inflight.get(p)).filter((job): job is Promise<void> => Boolean(job));
  if (pending.length > 0) await Promise.all(pending);
}

async function resolveSignedUrls(paths: string[]): Promise<(string | null)[]> {
  const trimmed = paths.map(normalizePath);
  const unique = [...new Set(trimmed.filter(Boolean))];
  if (unique.length === 0) return paths.map(() => null);
  await signMissingPaths(unique);
  return trimmed.map((path) => {
    if (!path) return null;
    if (isDirectMediaUrl(path)) return path;
    return readCache(path);
  });
}

export async function getPostMediaSignedUrls(paths: string[]): Promise<(string | null)[]> {
  return resolveSignedUrls(paths);
}

export async function getPostMediaSignedUrl(path: string): Promise<string | null> {
  const [url] = await resolveSignedUrls([path]);
  return url;
}

function mimeFromPathAndBlob(path: string, blob: Blob): string {
  if (blob.type && blob.type !== "application/octet-stream") return blob.type;
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "image/jpeg";
}

/** Download a post image/video as a File so it can be re-uploaded as a story. */
export async function fileFromPostMediaPath(path: string): Promise<File | null> {
  const url = await getPostMediaSignedUrl(path);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size <= 0) return null;
  const name = path.split("/").pop()?.trim() || "story.jpg";
  return new File([blob], name, { type: mimeFromPathAndBlob(path, blob) });
}

/** Sign story files and start downloading the first few so a tap can paint immediately. */
export function prefetchStoryMedia(
  items: { path: string; kind?: string | null }[],
  options?: { preloadImages?: number; preloadVideos?: number },
): void {
  const entries = items
    .map((item) => ({ path: normalizePath(item.path), kind: item.kind }))
    .filter((item) => item.path);
  if (entries.length === 0) return;

  const preloadImages = options?.preloadImages ?? 8;
  const preloadVideos = options?.preloadVideos ?? 1;

  void (async () => {
    await signMissingPaths(entries.map((entry) => entry.path));
    let images = 0;
    let videos = 0;
    for (const entry of entries) {
      const url = readCache(entry.path);
      if (!url) continue;
      if (isVideoPath(entry.path, entry.kind)) {
        if (videos >= preloadVideos) continue;
        preloadVideo(url);
        videos += 1;
      } else if (images < preloadImages) {
        preloadImage(url);
        images += 1;
      }
    }
  })();
}

/** Warm the signed-URL cache (and optionally preload image bytes) for feed media. */
export function prefetchPostMediaSignedUrls(
  paths: string[],
  options?: { preloadImages?: number },
): void {
  const trimmed = paths.map(normalizePath).filter(Boolean);
  if (trimmed.length === 0) return;

  void (async () => {
    await signMissingPaths(trimmed);
    const preloadN = options?.preloadImages ?? 0;
    if (preloadN <= 0) return;
    let loaded = 0;
    for (const path of trimmed) {
      if (loaded >= preloadN) break;
      const url = readCache(path);
      if (!url) continue;
      const lower = path.toLowerCase();
      const isVideo =
        lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm") || lower.includes("/video.");
      if (!isVideo) {
        preloadImage(url);
        loaded += 1;
      }
    }
  })();
}
