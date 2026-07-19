/**
 * Profile pictures: Supabase Storage bucket `profile_pictures`, paths `avatar/{userId}-{timestamp}{ext}`.
 *
 * Signed display URLs are cached and batch-fetched (same pattern as community post media)
 * so feed avatars do not each trigger a separate createSignedUrl round-trip.
 */
import { isOnline } from "./offline";
import { getSupabase } from "./supabase";

export const PROFILE_PICTURES_BUCKET = "profile_pictures";
const LEGACY_AVATARS_BUCKET = "avatars";

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${PROFILE_PICTURES_BUCKET}/`;

const SIGNED_URL_SECONDS = 3600;
const CACHE_TTL_MS = 50 * 60 * 1000;
const SIGN_CHUNK_SIZE = 40;

type CacheEntry = { url: string; expiresAt: number };

const urlCache = new Map<string, CacheEntry>();
const inflightPaths = new Set<string>();
const inflightResolves = new Map<string, Promise<ResolveProfileImageUrlResult>>();

function normalizeKey(path: string): string {
  return path.trim().replace(/^\/+/, "");
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

/**
 * If `profiles.avatar_url` stores a full Supabase public object URL for this bucket,
 * return the Storage object key so we can createSignedUrl (private bucket).
 */
export function extractProfilePicturesObjectKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(PUBLIC_OBJECT_PREFIX);
    if (idx === -1) return null;
    const keyPart = u.pathname.slice(idx + PUBLIC_OBJECT_PREFIX.length);
    if (!keyPart) return null;
    return normalizeKey(decodeURIComponent(keyPart));
  } catch {
    return null;
  }
}

/** Storage key used for signing/caching, or null for passthrough http(s) URLs. */
export function profileAvatarStorageKey(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const t = path.trim();
  if (/^https?:\/\//i.test(t)) {
    return extractProfilePicturesObjectKeyFromUrl(t);
  }
  return normalizeKey(t);
}

function bucketForKey(key: string): string {
  return key.startsWith(`${LEGACY_AVATARS_BUCKET}/`) ? LEGACY_AVATARS_BUCKET : PROFILE_PICTURES_BUCKET;
}

/** Synchronous read for instant paint when URLs were prefetched or recently resolved. */
export function getCachedProfileImageUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const t = path.trim();
  if (/^https?:\/\//i.test(t)) {
    const extracted = extractProfilePicturesObjectKeyFromUrl(t);
    if (!extracted) return t;
    return readCache(extracted);
  }
  return readCache(normalizeKey(t));
}

function preloadImage(url: string): void {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

async function signChunk(bucket: string, paths: string[]): Promise<Map<string, string | null>> {
  const supabase = getSupabase();
  const out = new Map<string, string | null>();
  if (!supabase || paths.length === 0) return out;

  const storage = supabase.storage.from(bucket);
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

async function signMissingKeys(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.map(normalizeKey).filter(Boolean))];
  const missing = unique.filter((p) => !readCache(p) && !inflightPaths.has(p));
  if (missing.length === 0) return;

  for (const p of missing) inflightPaths.add(p);
  try {
    const byBucket = new Map<string, string[]>();
    for (const key of missing) {
      const bucket = bucketForKey(key);
      const list = byBucket.get(bucket) ?? [];
      list.push(key);
      byBucket.set(bucket, list);
    }
    for (const [bucket, paths] of byBucket) {
      for (let i = 0; i < paths.length; i += SIGN_CHUNK_SIZE) {
        const chunk = paths.slice(i, i + SIGN_CHUNK_SIZE);
        const signed = await signChunk(bucket, chunk);
        for (const [path, url] of signed) {
          if (url) writeCache(path, url);
        }
      }
    }
  } finally {
    for (const p of missing) inflightPaths.delete(p);
  }
}

/** Warm the signed-URL cache (and optionally preload image bytes) for profile avatars. */
export function prefetchProfileAvatarUrls(
  paths: Array<string | null | undefined>,
  options?: { preloadImages?: number },
): void {
  const keys = [
    ...new Set(
      paths
        .map((p) => profileAvatarStorageKey(p))
        .filter((k): k is string => Boolean(k)),
    ),
  ];
  if (keys.length === 0) return;
  if (!isOnline()) return;

  void (async () => {
    await signMissingKeys(keys);
    const preloadN = options?.preloadImages ?? 0;
    if (preloadN <= 0) return;
    let loaded = 0;
    for (const key of keys) {
      if (loaded >= preloadN) break;
      const url = readCache(key);
      if (!url) continue;
      preloadImage(url);
      loaded += 1;
    }
  })();
}

function safeFileExtension(file: File): string {
  const n = file.name;
  const i = n.lastIndexOf(".");
  if (i < 0) return ".jpg";
  const ext = n.slice(i).replace(/[^a-zA-Z0-9.]/g, "");
  return ext.length > 0 && ext.length <= 8 ? ext : ".jpg";
}

/** Public URL for an object key (works when the bucket/object is publicly readable). */
export function getPublicUrl(path: string): { publicUrl: string | null } {
  const supabase = getSupabase();
  if (!supabase || !path.trim()) return { publicUrl: null };
  const key = normalizeKey(path);
  const { data } = supabase.storage.from(PROFILE_PICTURES_BUCKET).getPublicUrl(key);
  return { publicUrl: data.publicUrl ?? null };
}

export async function uploadProfileAvatar(file: File): Promise<{
  path?: string;
  publicUrl?: string | null;
  error?: Error;
}> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: new Error("Not signed in") };

  const ext = safeFileExtension(file);
  const path = `avatar/${user.id}-${Date.now()}${ext}`;

  const { error } = await supabase.storage.from(PROFILE_PICTURES_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) return { error: new Error(error.message) };

  const { data } = supabase.storage.from(PROFILE_PICTURES_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl ?? null };
}

/** Remove object at `path` from `profile_pictures`, or legacy `avatars/` key from the avatars bucket. */
export async function deleteProfileAvatar(path: string): Promise<{ error?: Error }> {
  if (!path.trim()) return {};
  const p = normalizeKey(path);
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  try {
    urlCache.delete(p);
    if (p.startsWith(`${LEGACY_AVATARS_BUCKET}/`)) {
      const { error } = await supabase.storage.from(LEGACY_AVATARS_BUCKET).remove([p]);
      if (error) return { error: new Error(error.message) };
      return {};
    }
    const { error } = await supabase.storage.from(PROFILE_PICTURES_BUCKET).remove([p]);
    if (error) return { error: new Error(error.message) };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export type ResolveProfileImageUrlResult = { url: string | null; error?: string };

async function resolveProfileImageUrlResultUncached(
  path: string,
): Promise<ResolveProfileImageUrlResult> {
  const t = path.trim();

  if (/^https?:\/\//i.test(t)) {
    const extracted = extractProfilePicturesObjectKeyFromUrl(t);
    if (extracted) {
      if (!isOnline()) return { url: null };
      await signMissingKeys([extracted]);
      const url = readCache(extracted);
      return url ? { url } : { url: null, error: "No signed URL returned" };
    }
    return { url: t };
  }

  if (!isOnline()) {
    // Private bucket keys need a signed URL from the network — fall back to initials offline.
    return { url: null };
  }

  const p = normalizeKey(t);
  const supabase = getSupabase();
  if (!supabase) return { url: null, error: "Supabase not configured" };

  try {
    await signMissingKeys([p]);
    const url = readCache(p);
    return url ? { url } : { url: null, error: "No signed URL returned" };
  } catch (e) {
    return {
      url: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Resolves `profiles.avatar_url` to a display URL, with an error message when signing fails
 * (e.g. missing Storage SELECT policy on `profile_pictures`).
 */
export async function resolveProfileImageUrlResult(
  path: string | null | undefined,
): Promise<ResolveProfileImageUrlResult> {
  if (!path?.trim()) return { url: null };
  const t = path.trim();

  const cached = getCachedProfileImageUrl(t);
  if (cached) return { url: cached };

  const dedupeKey = profileAvatarStorageKey(t) ?? t;
  const existing = inflightResolves.get(dedupeKey);
  if (existing) return existing;

  const promise = resolveProfileImageUrlResultUncached(t).finally(() => {
    inflightResolves.delete(dedupeKey);
  });
  inflightResolves.set(dedupeKey, promise);
  return promise;
}

/**
 * Display URL for `profiles.avatar_url`: absolute URL, legacy `avatars/…`, or `profile_pictures` key
 * (`avatar/…`, `{uuid}.jpg`, etc.).
 */
export async function resolveProfileImageUrl(
  path: string | null | undefined,
): Promise<string | null> {
  const { url } = await resolveProfileImageUrlResult(path);
  return url ?? null;
}

/** @deprecated Use resolveProfileImageUrl */
export async function getSignedAvatarUrl(path: string): Promise<{ url: string | null }> {
  const { url } = await resolveProfileImageUrlResult(path);
  return { url };
}
