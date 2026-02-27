/**
 * Profile data (full_name, avatar) and avatar storage helpers.
 * Uses Supabase profiles table and avatars bucket.
 */
import { getSupabase } from "./supabase";

const AVATARS_BUCKET = "avatars";

export type ProfileRow = {
  full_name: string | null;
  avatar_url: string | null;
};

/** Fetch profile by user id. */
export async function getProfile(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return {
    full_name: data.full_name ?? null,
    avatar_url: data.avatar_url ?? null,
  };
}

/** Upsert profile (full_name, optional avatar_url). */
export async function upsertProfile(
  userId: string,
  { full_name, avatar_url }: { full_name?: string | null; avatar_url?: string | null },
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const payload: Record<string, unknown> = {};
  if (full_name !== undefined) payload.full_name = full_name ?? null;
  if (avatar_url !== undefined) payload.avatar_url = avatar_url ?? null;
  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...payload }, { onConflict: "id" });

  return { error: error ? new Error(error.message) : null };
}

/** Upload avatar to avatars/{userId}/{timestamp}-{filename}. Returns storage path on success. */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<{ path: string } | { error: Error }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const path = `avatars/${userId}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) return { error: new Error(error.message) };
  return { path };
}

/** Get a signed URL for displaying an avatar. Path is the storage path from uploadAvatar. */
export async function getSignedAvatarUrl(
  path: string,
  expiresSeconds = 3600,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, expiresSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
