/**
 * Supabase `profiles` + React Query cache. Avatar files: `storage-profile.ts`.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { getSupabase } from "./supabase";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  onboarding_complete?: boolean | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_notes?: string | null;
};

export const profileQueryKey = (userId: string | undefined) => ["profile", userId] as const;

function rowFromData(data: Record<string, unknown>): ProfileRow {
  return {
    id: String(data.id),
    full_name: (data.full_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    bio: (data.bio as string | null) ?? null,
    is_public: typeof data.is_public === "boolean" ? data.is_public : true,
    onboarding_complete:
      typeof data.onboarding_complete === "boolean" ? data.onboarding_complete : null,
    emergency_contact_name: (data.emergency_contact_name as string | null) ?? null,
    emergency_contact_phone: (data.emergency_contact_phone as string | null) ?? null,
    emergency_notes: (data.emergency_notes as string | null) ?? null,
  };
}

export async function getProfile(userId: string): Promise<{ profile: ProfileRow | null }> {
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
    return { profile: rowFromData(data as Record<string, unknown>) };
  } catch {
    return { profile: null };
  }
}

export type ProfileUpdatePayload = {
  id: string;
} & Partial<Pick<ProfileRow, "full_name" | "avatar_url" | "bio" | "is_public">>;

export async function updateProfile(
  payload: ProfileUpdatePayload,
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { id, full_name, avatar_url, bio, is_public } = payload;
  const update: Record<string, unknown> = { id };
  if (full_name !== undefined) update.full_name = full_name ?? null;
  if (avatar_url !== undefined) update.avatar_url = avatar_url ?? null;
  if (bio !== undefined) update.bio = bio ?? null;
  if (is_public !== undefined) update.is_public = is_public;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(update, { onConflict: "id" })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return {
      data: data ? rowFromData(data as Record<string, unknown>) : null,
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/** Upsert any profile fields (onboarding, emergency sync). */
export async function upsertProfile(payload: {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_public?: boolean | null;
  onboarding_complete?: boolean | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_notes?: string | null;
}): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const {
    id,
    full_name,
    avatar_url,
    bio,
    is_public,
    onboarding_complete,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_notes,
  } = payload;

  const update: Record<string, unknown> = { id };
  if (full_name !== undefined) update.full_name = full_name ?? null;
  if (avatar_url !== undefined) update.avatar_url = avatar_url ?? null;
  if (bio !== undefined) update.bio = bio ?? null;
  if (is_public !== undefined) update.is_public = is_public;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;
  if (emergency_contact_name !== undefined) {
    update.emergency_contact_name = emergency_contact_name ?? null;
  }
  if (emergency_contact_phone !== undefined) {
    update.emergency_contact_phone = emergency_contact_phone ?? null;
  }
  if (emergency_notes !== undefined) update.emergency_notes = emergency_notes ?? null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(update, { onConflict: "id" })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return {
      data: data ? rowFromData(data as Record<string, unknown>) : null,
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const q = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!userId) return null;
      const { profile } = await getProfile(userId);
      return profile;
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
  }, [queryClient, userId]);

  const err = q.error;
  const error =
    err instanceof Error ? err : err != null ? new Error(String(err)) : null;

  return {
    profile: q.data ?? null,
    loading: q.isPending,
    error,
    refresh,
  };
}
