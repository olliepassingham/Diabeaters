/**
 * Profile data (full_name, avatar) and avatar storage helpers.
 * Uses Supabase profiles table and avatars bucket.
 */
import { getSupabase } from "./supabase";

const AVATARS_BUCKET = "avatars";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

/** Fetch profile by user id. Returns { profile: null } if no row exists. */
export async function getProfile(
  userId: string,
): Promise<{ profile: ProfileRow | null }> {
  const supabase = getSupabase();
  if (!supabase) return { profile: null };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) return { profile: null };
    return {
      profile: {
        id: data.id,
        full_name: data.full_name ?? null,
        avatar_url: data.avatar_url ?? null,
      },
    };
  } catch {
    return { profile: null };
  }
}

/** Upsert profile by primary key id. */
export async function upsertProfile(
  payload: { id: string; full_name?: string | null; avatar_url?: string | null },
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: null, error: new Error("Supabase not configured") };
  }

  try {
    const { id, full_name, avatar_url } = payload;
    const update: Record<string, unknown> = { id };
    if (full_name !== undefined) update.full_name = full_name ?? null;
    if (avatar_url !== undefined) update.avatar_url = avatar_url ?? null;

    const { data, error } = await supabase
      .from("profiles")
      .upsert(update, { onConflict: "id" })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return {
      data: data
        ? {
            id: data.id,
            full_name: data.full_name ?? null,
            avatar_url: data.avatar_url ?? null,
          }
        : null,
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/** Upload avatar. Path: avatars/{userId}/{timestamp}-{filename}. Returns { path } only. */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<{ path?: string; error?: Error }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: new Error("Supabase not configured") };
  }

  const path = `avatars/${userId}/${Date.now()}-${file.name}`;

  try {
    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { upsert: true });

    if (error) return { error: new Error(error.message) };
    return { path };
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/** Get a signed URL for displaying an avatar. Returns { url: null } if path empty. */
export async function getSignedAvatarUrl(
  path: string,
  expiresSeconds = 3600,
): Promise<{ url: string | null }> {
  if (!path || typeof path !== "string" || path.trim() === "") {
    return { url: null };
  }
  const supabase = getSupabase();
  if (!supabase) return { url: null };

  try {
    const { data, error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(path.trim(), expiresSeconds);

    if (error || !data?.signedUrl) return { url: null };
    return { url: data.signedUrl };
  } catch {
    return { url: null };
  }
}
