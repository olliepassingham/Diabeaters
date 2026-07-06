import { getSupabase } from "@/lib/supabase";

const COMMUNITY_POST_IMAGES_BUCKET = "community_post_images";

const SIGNED_URL_SECONDS = 3600;
/** Refresh before the storage token expires. */
const CACHE_TTL_MS = 50 * 60 * 1000;
const SIGN_CHUNK_SIZE = 40;

type CacheEntry = { url: string; expiresAt: number };

const urlCache = new Map<string, CacheEntry>();
const inflightPaths = new Set<string>();

function normalizePath(path: string): string {
  return String(path ?? "").trim();
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
  return readCache(trimmed);
}

function preloadImage(url: string): void {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
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
      for (const item of data) {
        const url = item.error ? null : item.signedUrl || null;
        out.set(item.path, url);
      }
      return out;
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
  const unique = [...new Set(paths.map(normalizePath).filter(Boolean))];
  const missing = unique.filter((p) => !readCache(p) && !inflightPaths.has(p));
  if (missing.length === 0) return;

  for (const p of missing) inflightPaths.add(p);
  try {
    for (let i = 0; i < missing.length; i += SIGN_CHUNK_SIZE) {
      const chunk = missing.slice(i, i + SIGN_CHUNK_SIZE);
      const signed = await signChunk(chunk);
      for (const [path, url] of signed) {
        if (url) writeCache(path, url);
      }
    }
  } finally {
    for (const p of missing) inflightPaths.delete(p);
  }
}

async function resolveSignedUrls(paths: string[]): Promise<(string | null)[]> {
  const trimmed = paths.map(normalizePath);
  const unique = [...new Set(trimmed.filter(Boolean))];
  if (unique.length === 0) return paths.map(() => null);
  await signMissingPaths(unique);
  return trimmed.map((path) => (path ? readCache(path) : null));
}

export async function getPostMediaSignedUrls(paths: string[]): Promise<(string | null)[]> {
  return resolveSignedUrls(paths);
}

export async function getPostMediaSignedUrl(path: string): Promise<string | null> {
  const [url] = await resolveSignedUrls([path]);
  return url;
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
