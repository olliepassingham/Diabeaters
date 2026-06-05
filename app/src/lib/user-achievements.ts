import {
  ACHIEVEMENT_DEFINITIONS,
  evaluateNewlyUnlockedAchievements,
  getAchievementDefinition,
  type AchievementId,
} from "@/lib/achievements";
import { collectAllActivityEvents } from "@/lib/activity-history";
import { getSupabase } from "@/lib/supabase";

const EARNED_STORAGE_KEY = "diabeater_user_achievements";
const PINNED_STORAGE_KEY = "diabeater_pinned_achievement_ids";
export const MAX_PINNED_ACHIEVEMENTS = 5;

export const USER_ACHIEVEMENTS_CHANGED_EVENT = "diabeater:user-achievements-changed";

export type EarnedAchievement = {
  id: AchievementId;
  earnedAt: string;
};

export type PublicProfileAchievement = {
  id: AchievementId;
  title: string;
};

function isAchievementId(value: string): value is AchievementId {
  return ACHIEVEMENT_DEFINITIONS.some((d) => d.id === value);
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(USER_ACHIEVEMENTS_CHANGED_EVENT));
}

export function loadEarnedAchievements(): EarnedAchievement[] {
  try {
    const raw = localStorage.getItem(EARNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: EarnedAchievement[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const id = String((row as { id?: unknown }).id ?? "");
      const earnedAt = String((row as { earnedAt?: unknown }).earnedAt ?? "");
      if (!isAchievementId(id) || !earnedAt) continue;
      out.push({ id, earnedAt });
    }
    return out;
  } catch {
    return [];
  }
}

function saveEarnedAchievementsLocal(rows: EarnedAchievement[]): void {
  localStorage.setItem(EARNED_STORAGE_KEY, JSON.stringify(rows));
  dispatchChanged();
}

export function loadPinnedAchievementIds(): AchievementId[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is AchievementId => typeof id === "string" && isAchievementId(id));
  } catch {
    return [];
  }
}

export function savePinnedAchievementIds(ids: AchievementId[]): void {
  const earned = new Set(loadEarnedAchievements().map((a) => a.id));
  const unique: AchievementId[] = [];
  for (const id of ids) {
    if (!earned.has(id) || unique.includes(id)) continue;
    unique.push(id);
    if (unique.length >= MAX_PINNED_ACHIEVEMENTS) break;
  }
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(unique));
  dispatchChanged();
}

export function togglePinnedAchievement(id: AchievementId): AchievementId[] {
  const earned = new Set(loadEarnedAchievements().map((a) => a.id));
  if (!earned.has(id)) return loadPinnedAchievementIds();

  const current = loadPinnedAchievementIds();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : current.length >= MAX_PINNED_ACHIEVEMENTS
      ? current
      : [...current, id];
  savePinnedAchievementIds(next);
  return next;
}

export async function syncPinnedAchievementsToProfile(
  userId: string,
  ids?: AchievementId[],
): Promise<{ error: Error | null }> {
  const pinned = ids ?? loadPinnedAchievementIds();
  savePinnedAchievementIds(pinned);
  const { updateProfile } = await import("./profile");
  const { error } = await updateProfile({ id: userId, pinned_achievement_ids: pinned });
  return { error };
}

export async function loadPinnedAchievementsFromProfile(userId: string): Promise<void> {
  const { getProfile } = await import("./profile");
  const { profile } = await getProfile(userId);
  if (!profile?.pinned_achievement_ids?.length) return;
  savePinnedAchievementIds(
    profile.pinned_achievement_ids.filter((id): id is AchievementId =>
      ACHIEVEMENT_DEFINITIONS.some((d) => d.id === id),
    ),
  );
}

/** Evaluate streaks, persist new unlocks locally, optionally sync to cloud. Returns newly unlocked ids. */
export function syncAchievementsFromActivity(options?: {
  showToasts?: boolean;
  userId?: string | null;
}): AchievementId[] {
  const events = collectAllActivityEvents();
  const earned = loadEarnedAchievements();
  const earnedIds = new Set(earned.map((a) => a.id));
  const newlyUnlocked = evaluateNewlyUnlockedAchievements(events, earnedIds);

  if (newlyUnlocked.length === 0) return [];

  const now = new Date().toISOString();
  const merged = [...earned];
  for (const id of newlyUnlocked) {
    merged.push({ id, earnedAt: now });
  }
  saveEarnedAchievementsLocal(merged);

  if (options?.userId) {
    void pushAchievementsToCloud(options.userId, newlyUnlocked.map((id) => ({ id, earnedAt: now })));
  }

  if (options?.showToasts && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("diabeater:achievement-unlocked", {
        detail: { ids: newlyUnlocked },
      }),
    );
  }

  return newlyUnlocked;
}

export async function fetchCloudAchievements(userId: string): Promise<EarnedAchievement[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", userId);

    if (error || !data) return [];

    const out: EarnedAchievement[] = [];
    for (const row of data) {
      const id = String((row as { achievement_id?: unknown }).achievement_id ?? "");
      const earnedAt = String((row as { earned_at?: unknown }).earned_at ?? "");
      if (!isAchievementId(id) || !earnedAt) continue;
      out.push({ id, earnedAt });
    }
    return out;
  } catch {
    return [];
  }
}

export async function pushAchievementsToCloud(
  userId: string,
  rows: EarnedAchievement[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return;

  try {
    await supabase.from("user_achievements").upsert(
      rows.map((row) => ({
        user_id: userId,
        achievement_id: row.id,
        earned_at: row.earnedAt,
      })),
      { onConflict: "user_id,achievement_id" },
    );
  } catch {
    /* offline or migration pending */
  }
}

/** Merge cloud achievements into local storage (keeps earliest earnedAt per id). */
export async function mergeCloudAchievements(userId: string): Promise<void> {
  await loadPinnedAchievementsFromProfile(userId);

  const cloud = await fetchCloudAchievements(userId);
  if (cloud.length === 0) return;

  const local = loadEarnedAchievements();
  const byId = new Map<string, EarnedAchievement>();
  for (const row of [...local, ...cloud]) {
    const prev = byId.get(row.id);
    if (!prev || row.earnedAt < prev.earnedAt) byId.set(row.id, row);
  }

  const merged = [...byId.values()].sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  saveEarnedAchievementsLocal(merged);

  const missingOnCloud = merged.filter((row) => !cloud.some((c) => c.id === row.id));
  if (missingOnCloud.length > 0) {
    await pushAchievementsToCloud(userId, missingOnCloud);
  }
}

export async function fetchPublicProfileAchievements(
  userId: string,
  pinnedIds: string[] | null | undefined,
): Promise<PublicProfileAchievement[]> {
  if (!pinnedIds?.length) return [];

  const validPinned = pinnedIds.filter(isAchievementId).slice(0, MAX_PINNED_ACHIEVEMENTS);
  if (validPinned.length === 0) return [];

  const supabase = getSupabase();
  if (!supabase) {
    return validPinned.map((id) => ({
      id,
      title: getAchievementDefinition(id).title,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)
      .in("achievement_id", validPinned);

    if (error || !data) return [];

    const earned = new Set(
      data.map((row) => String((row as { achievement_id?: unknown }).achievement_id ?? "")),
    );

    return validPinned
      .filter((id) => earned.has(id))
      .map((id) => ({
        id,
        title: getAchievementDefinition(id).title,
      }));
  } catch {
    return [];
  }
}

export function publicAchievementsFromPinnedIds(pinnedIds: string[] | null | undefined): PublicProfileAchievement[] {
  if (!pinnedIds?.length) return [];
  return pinnedIds
    .filter(isAchievementId)
    .slice(0, MAX_PINNED_ACHIEVEMENTS)
    .map((id) => ({
      id,
      title: getAchievementDefinition(id).title,
    }));
}
