/**
 * Supabase `profiles` + React Query cache. Avatar files: `storage-profile.ts`.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { getSupabase } from "./supabase";
import { normalizeDateOfBirthInput } from "./user-age";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  /** Lowercase community @handle; unique when set. */
  public_handle: string | null;
  is_public: boolean;
  onboarding_complete?: boolean | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_notes?: string | null;
  /** ISO date YYYY-MM-DD; optional community-only. */
  diabetes_onset_date?: string | null;
  /** pen | pump; owner sync from app (not exposed in batch community profile selects). */
  insulin_delivery_method?: string | null;
  /** Total daily insulin (units); optional owner sync from app settings. */
  tdd?: number | null;
  /** Optional YYYY-MM-DD; owner or linked supporter (when permitted) may set on cloud profile. */
  date_of_birth?: string | null;
  /** Owner-managed primary pharmacy + opening hours JSON; never selected for community batches. */
  pharmacy?: PharmacyJson | null;
  /** patient = full tools; community = learn + feed persona. */
  account_type?: "patient" | "community" | null;
  app_region?: "UK" | "US" | "OTHER" | null;
  emergency_number?: string | null;
};

/** Loose JSON shape kept on `profiles.pharmacy`; canonical type lives in `storage.ts`. */
export type PharmacyJson = {
  name?: string;
  phone?: string;
  addressLine?: string;
  notes?: string;
  hours?: Record<string, { open?: string; close?: string; closed?: boolean; break?: { start?: string; end?: string } }>;
  updatedAt?: string;
};

/** Safe fields for community public profile pages (never include emergency_*). */
export type PublicCommunityProfile = Pick<
  ProfileRow,
  "id" | "full_name" | "avatar_url" | "bio" | "public_handle" | "is_public" | "diabetes_onset_date"
>;

export const profileQueryKey = (userId: string | undefined) => ["profile", userId] as const;

/** Batch / community fetches: exclude owner-only clinical columns from the select list. */
const PROFILE_LIST_SELECT =
  "id, full_name, avatar_url, bio, public_handle, is_public, onboarding_complete, emergency_contact_name, emergency_contact_phone, emergency_notes, diabetes_onset_date";

function rowFromData(data: Record<string, unknown>): ProfileRow {
  const rawTdd = data.tdd;
  let tdd: number | null | undefined;
  if (rawTdd === null) tdd = null;
  else if (typeof rawTdd === "number" && Number.isFinite(rawTdd)) tdd = rawTdd;
  else tdd = undefined;

  const idm = data.insulin_delivery_method;
  let insulin_delivery_method: string | null | undefined;
  if (typeof idm === "string") {
    const m = idm.trim().toLowerCase();
    if (m === "pen" || m === "pump") insulin_delivery_method = m;
    else insulin_delivery_method = null;
  } else if (idm === null) insulin_delivery_method = null;
  else if (idm === undefined) insulin_delivery_method = undefined;
  else insulin_delivery_method = null;

  const rawDob = data.date_of_birth;
  let date_of_birth: string | null | undefined;
  if (rawDob === null) date_of_birth = null;
  else if (rawDob === undefined) date_of_birth = undefined;
  else date_of_birth = normalizeDateOfBirthInput(String(rawDob)) ?? null;

  const rawPharmacy = data.pharmacy;
  let pharmacy: PharmacyJson | null | undefined;
  if (rawPharmacy === null) pharmacy = null;
  else if (rawPharmacy === undefined) pharmacy = undefined;
  else if (typeof rawPharmacy === "object") pharmacy = rawPharmacy as PharmacyJson;
  else pharmacy = null;

  const rawAccountType = data.account_type;
  let account_type: "patient" | "community" | null | undefined;
  if (rawAccountType === null) account_type = null;
  else if (rawAccountType === undefined) account_type = undefined;
  else if (rawAccountType === "patient" || rawAccountType === "community") account_type = rawAccountType;
  else account_type = "patient";

  const rawRegion = data.app_region;
  let app_region: "UK" | "US" | "OTHER" | null | undefined;
  if (rawRegion === null) app_region = null;
  else if (rawRegion === undefined) app_region = undefined;
  else if (rawRegion === "UK" || rawRegion === "US" || rawRegion === "OTHER") app_region = rawRegion;
  else app_region = null;

  const rawEmergency = data.emergency_number;
  let emergency_number: string | null | undefined;
  if (rawEmergency === null) emergency_number = null;
  else if (rawEmergency === undefined) emergency_number = undefined;
  else emergency_number = String(rawEmergency).trim() || null;

  return {
    id: String(data.id),
    full_name: (data.full_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    bio: (data.bio as string | null) ?? null,
    public_handle: (data.public_handle as string | null) ?? null,
    is_public: typeof data.is_public === "boolean" ? data.is_public : true,
    onboarding_complete:
      typeof data.onboarding_complete === "boolean" ? data.onboarding_complete : null,
    emergency_contact_name: (data.emergency_contact_name as string | null) ?? null,
    emergency_contact_phone: (data.emergency_contact_phone as string | null) ?? null,
    emergency_notes: (data.emergency_notes as string | null) ?? null,
    diabetes_onset_date: (data.diabetes_onset_date as string | null) ?? null,
    insulin_delivery_method,
    tdd,
    date_of_birth,
    pharmacy,
    account_type,
    app_region,
    emergency_number,
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

/** Batch fetch for timelines / lists (RLS: public profiles visible to authenticated users). */
export async function getProfilesByIds(userIds: string[]): Promise<Map<string, ProfileRow>> {
  const supabase = getSupabase();
  const map = new Map<string, ProfileRow>();
  if (!supabase || userIds.length === 0) return map;

  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return map;

  try {
    const { data, error } = await supabase.from("profiles").select(PROFILE_LIST_SELECT).in("id", unique);
    if (error || !data) return map;
    for (const row of data) {
      map.set(String((row as Record<string, unknown>).id), rowFromData(row as Record<string, unknown>));
    }
    return map;
  } catch {
    return map;
  }
}

/** Public line for community profile from ISO date YYYY-MM-DD (local calendar). */
export function formatLivingWithDiabetesLine(isoDate: string | null | undefined): string | null {
  if (!isoDate?.trim()) return null;
  const parts = isoDate.trim().split("-").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  if (start > today) return null;

  let years = today.getFullYear() - start.getFullYear();
  const md = today.getMonth() - start.getMonth();
  const dd = today.getDate() - start.getDate();
  if (md < 0 || (md === 0 && dd < 0)) years -= 1;

  if (years >= 1) {
    return `Living with diabetes for ~${years} ${years === 1 ? "year" : "years"}`;
  }

  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) months -= 1;
  if (months >= 1) {
    return `Living with diabetes for ~${months} ${months === 1 ? "month" : "months"}`;
  }

  return "Living with diabetes";
}

/** Normalize and validate public handle: 3–30 chars, [a-z0-9_]. Returns null if empty clear, throws if invalid. */
export function normalizePublicHandleInput(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (t === "") return null;
  if (!/^[_a-z0-9]{3,30}$/.test(t)) {
    throw new Error("Handle must be 3–30 characters: letters, numbers, underscores.");
  }
  return t;
}

/** Load only community-safe columns for another user's profile card. */
export async function getPublicCommunityProfile(userId: string): Promise<{
  profile: PublicCommunityProfile | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { profile: null, error: new Error("Supabase not configured") };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, bio, public_handle, is_public, diabetes_onset_date")
      .eq("id", userId)
      .maybeSingle();

    if (error) return { profile: null, error: new Error(error.message) };
    if (!data) return { profile: null, error: null };
    const r = data as Record<string, unknown>;
    const profile: PublicCommunityProfile = {
      id: String(r.id),
      full_name: (r.full_name as string | null) ?? null,
      avatar_url: (r.avatar_url as string | null) ?? null,
      bio: (r.bio as string | null) ?? null,
      public_handle: (r.public_handle as string | null) ?? null,
      is_public: typeof r.is_public === "boolean" ? r.is_public : true,
      diabetes_onset_date: (r.diabetes_onset_date as string | null) ?? null,
    };
    if (!profile.is_public) return { profile: null, error: null };
    return { profile, error: null };
  } catch (e) {
    return { profile: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Postgres unique violation on profiles.public_handle (or migration index name). */
export function isProfileHandleUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "23505") return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("profiles_public_handle_unique") ||
    (msg.includes("public_handle") && msg.includes("unique"))
  );
}

export const PUBLIC_HANDLE_TAKEN_MESSAGE =
  "That @handle is already taken. Please choose another.";

/**
 * Whether a normalized handle is free for the current user to claim.
 * Pass `excludeUserId` so saving an unchanged handle does not count as taken.
 */
export async function isPublicHandleAvailable(
  handle: string,
  options?: { excludeUserId?: string },
): Promise<{ available: boolean; normalized: string | null; error: Error | null }> {
  let normalized: string;
  try {
    const n = normalizePublicHandleInput(handle.replace(/^@/, ""));
    if (!n) {
      return { available: false, normalized: null, error: new Error("Handle is required.") };
    }
    normalized = n;
  } catch (e) {
    return {
      available: false,
      normalized: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }

  const { userId, error } = await getProfileIdByPublicHandle(normalized);
  if (error) return { available: false, normalized, error };
  if (!userId) return { available: true, normalized, error: null };
  if (options?.excludeUserId && userId === options.excludeUserId) {
    return { available: true, normalized, error: null };
  }
  return { available: false, normalized, error: null };
}

export async function getProfileIdByPublicHandle(handle: string): Promise<{
  userId: string | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { userId: null, error: new Error("Supabase not configured") };

  let normalized: string;
  try {
    const n = normalizePublicHandleInput(handle.replace(/^@/, ""));
    if (n === null) return { userId: null, error: null };
    normalized = n;
  } catch {
    return { userId: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("public_handle", normalized)
      .maybeSingle();

    if (error) return { userId: null, error: new Error(error.message) };
    if (!data) return { userId: null, error: null };
    return { userId: String((data as Record<string, unknown>).id), error: null };
  } catch (e) {
    return { userId: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export type ProfileHandleSuggestion = Pick<ProfileRow, "id" | "full_name" | "avatar_url" | "public_handle" | "is_public">;

/** Autocomplete: public profiles whose handle starts with the given prefix. */
export async function searchProfilesByHandlePrefix(
  rawPrefix: string,
  limit = 10,
): Promise<{ data: ProfileHandleSuggestion[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const prefix = rawPrefix.trim().replace(/^@/, "").toLowerCase();
  if (!prefix) return { data: [], error: null };

  // Keep query permissive; RLS will still apply. Also filter to explicit public profiles.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, public_handle, is_public")
    .eq("is_public", true)
    .ilike("public_handle", `${prefix}%`)
    .order("public_handle", { ascending: true })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped: ProfileHandleSuggestion[] = rows.map((r) => ({
    id: String(r.id),
    full_name: (r.full_name as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    public_handle: (r.public_handle as string | null) ?? null,
    is_public: typeof r.is_public === "boolean" ? r.is_public : true,
  }));
  return { data: mapped.filter((p) => Boolean(p.public_handle?.trim())), error: null };
}

/** Feed search helper: public profiles matching handle prefix OR name substring. */
export async function searchPublicProfilesForFeedQuery(
  rawQuery: string,
  limit = 12,
): Promise<{ ids: string[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ids: [], error: new Error("Supabase not configured") };

  const q = rawQuery.trim().replace(/^@/, "");
  if (q.length < 2) return { ids: [], error: null };

  const lim = Math.max(1, Math.min(30, limit));
  try {
    // We do two small queries to keep indexes usable (prefix vs substring).
    const [byHandle, byName] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .eq("is_public", true)
        .ilike("public_handle", `${q.toLowerCase()}%`)
        .limit(lim),
      supabase
        .from("profiles")
        .select("id")
        .eq("is_public", true)
        .ilike("full_name", `%${q}%`)
        .limit(lim),
    ]);

    const err = byHandle.error ?? byName.error;
    if (err) return { ids: [], error: new Error(err.message) };

    const ids = new Set<string>();
    for (const row of (byHandle.data ?? []) as Array<{ id: string }>) ids.add(String(row.id));
    for (const row of (byName.data ?? []) as Array<{ id: string }>) ids.add(String(row.id));
    return { ids: [...ids].slice(0, lim), error: null };
  } catch (e) {
    return { ids: [], error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export type ProfileUpdatePayload = {
  id: string;
} & Partial<
  Pick<
    ProfileRow,
    | "full_name"
    | "avatar_url"
    | "bio"
    | "is_public"
    | "public_handle"
    | "diabetes_onset_date"
    | "insulin_delivery_method"
    | "tdd"
    | "date_of_birth"
    | "pharmacy"
    | "account_type"
    | "app_region"
    | "emergency_number"
  >
>;

export async function updateProfile(
  payload: ProfileUpdatePayload,
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const {
    id,
    full_name,
    avatar_url,
    bio,
    is_public,
    public_handle,
    diabetes_onset_date,
    insulin_delivery_method,
    tdd,
    date_of_birth,
    pharmacy,
    account_type,
    app_region,
    emergency_number,
  } = payload;
  const update: Record<string, unknown> = { id };
  if (full_name !== undefined) update.full_name = full_name ?? null;
  if (avatar_url !== undefined) update.avatar_url = avatar_url ?? null;
  if (bio !== undefined) update.bio = bio ?? null;
  if (is_public !== undefined) update.is_public = is_public;
  if (public_handle !== undefined) {
    if (public_handle === null || public_handle === "") {
      update.public_handle = null;
    } else {
      try {
        update.public_handle = normalizePublicHandleInput(public_handle);
      } catch (e) {
        return {
          data: null,
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }
      const availability = await isPublicHandleAvailable(String(update.public_handle), {
        excludeUserId: id,
      });
      if (availability.error && !availability.normalized) {
        return { data: null, error: availability.error };
      }
      if (!availability.available) {
        return { data: null, error: new Error(PUBLIC_HANDLE_TAKEN_MESSAGE) };
      }
    }
  }
  if (diabetes_onset_date !== undefined) {
    update.diabetes_onset_date = diabetes_onset_date?.trim() ? diabetes_onset_date.trim() : null;
  }
  if (insulin_delivery_method !== undefined) {
    if (insulin_delivery_method === null) {
      update.insulin_delivery_method = null;
    } else {
      const m = String(insulin_delivery_method).trim().toLowerCase();
      if (m === "pen" || m === "pump") {
        update.insulin_delivery_method = m;
      } else {
        update.insulin_delivery_method = null;
      }
    }
  }
  if (tdd !== undefined) {
    if (tdd === null) update.tdd = null;
    else if (typeof tdd === "number" && Number.isFinite(tdd) && tdd > 0) update.tdd = tdd;
    else update.tdd = null;
  }
  if (date_of_birth !== undefined) {
    if (date_of_birth === null) {
      update.date_of_birth = null;
    } else {
      const n = normalizeDateOfBirthInput(date_of_birth);
      update.date_of_birth = n ?? null;
    }
  }
  if (pharmacy !== undefined) {
    update.pharmacy = pharmacy ?? null;
  }
  if (account_type !== undefined) {
    if (account_type === null) update.account_type = "patient";
    else if (account_type === "patient" || account_type === "community") update.account_type = account_type;
  }
  if (app_region !== undefined) {
    if (app_region === null) update.app_region = null;
    else if (app_region === "UK" || app_region === "US" || app_region === "OTHER") update.app_region = app_region;
    else update.app_region = null;
  }
  if (emergency_number !== undefined) {
    update.emergency_number =
      emergency_number === null ? null : String(emergency_number).trim() || null;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(update, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      if (isProfileHandleUniqueViolation(error)) {
        return { data: null, error: new Error(PUBLIC_HANDLE_TAKEN_MESSAGE) };
      }
      return { data: null, error: new Error(error.message) };
    }
    return {
      data: data ? rowFromData(data as Record<string, unknown>) : null,
      error: null,
    };
  } catch (e) {
    if (isProfileHandleUniqueViolation(e)) {
      return { data: null, error: new Error(PUBLIC_HANDLE_TAKEN_MESSAGE) };
    }
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
  account_type?: "patient" | "community" | null;
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
    account_type,
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
  if (account_type !== undefined) {
    if (account_type === null) update.account_type = "patient";
    else if (account_type === "patient" || account_type === "community") update.account_type = account_type;
  }

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
