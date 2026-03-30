/**
 * Profile pictures: Supabase Storage bucket `profile_pictures`, paths `avatar/{userId}-{timestamp}{ext}`.
 */
import { getSupabase } from "./supabase";

export const PROFILE_PICTURES_BUCKET = "profile_pictures";
const LEGACY_AVATARS_BUCKET = "avatars";

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${PROFILE_PICTURES_BUCKET}/`;

function normalizeKey(path: string): string {
  return path.trim().replace(/^\/+/, "");
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

async function signedUrlForProfilePicturesKey(
  key: string,
): Promise<{ url: string | null; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { url: null, error: "Supabase not configured" };
  const { data, error } = await supabase.storage
    .from(PROFILE_PICTURES_BUCKET)
    .createSignedUrl(key, 3600);
  if (error) return { url: null, error: error.message };
  if (!data?.signedUrl) return { url: null, error: "No signed URL returned" };
  return { url: data.signedUrl };
}

export type ResolveProfileImageUrlResult = { url: string | null; error?: string };

/**
 * Resolves `profiles.avatar_url` to a display URL, with an error message when signing fails
 * (e.g. missing Storage SELECT policy on `profile_pictures`).
 */
export async function resolveProfileImageUrlResult(
  path: string | null | undefined,
): Promise<ResolveProfileImageUrlResult> {
  if (!path?.trim()) return { url: null };
  const t = path.trim();

  if (/^https?:\/\//i.test(t)) {
    const extracted = extractProfilePicturesObjectKeyFromUrl(t);
    if (extracted) {
      return signedUrlForProfilePicturesKey(extracted);
    }
    return { url: t };
  }

  const p = normalizeKey(t);
  const supabase = getSupabase();
  if (!supabase) return { url: null, error: "Supabase not configured" };

  try {
    if (p.startsWith(`${LEGACY_AVATARS_BUCKET}/`)) {
      const { data, error } = await supabase.storage
        .from(LEGACY_AVATARS_BUCKET)
        .createSignedUrl(p, 3600);
      if (error) return { url: null, error: error.message };
      if (!data?.signedUrl) return { url: null, error: "No signed URL returned" };
      return { url: data.signedUrl };
    }
    return signedUrlForProfilePicturesKey(p);
  } catch (e) {
    return {
      url: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
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
