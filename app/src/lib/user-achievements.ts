import {
  ACHIEVEMENT_DEFINITIONS,
  computeAllProfileStreakDays,
  evaluateNewlyUnlockedAchievements,
  getAchievementDefinition,
  isProfileStreakKind,
  type AchievementId,
  type ProfileStreakKind,
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

/** @deprecated Use PublicProfileStreak */
export type PublicProfileAchievement = PublicProfileStreak;

export type PublicProfileStreak = {
  kind: ProfileStreakKind;
  days: number;
};

function isAchievementId(value: string): value is AchievementId {
  return ACHIEVEMENT_DEFINITIONS.some((d) => d.id === value);
}

function achievementIdToStreakKind(id: AchievementId): ProfileStreakKind {
  return getAchievementDefinition(id).streakKind;
}

function normalizePinnedStreakKinds(raw: string[]): ProfileStreakKind[] {
  const out: ProfileStreakKind[] = [];
  for (const value of raw) {
    let kind: ProfileStreakKind | null = null;
    if (isProfileStreakKind(value)) {
      kind = value;
    } else if (isAchievementId(value)) {
      kind = achievementIdToStreakKind(value);
    }
    if (!kind || out.includes(kind)) continue;
    out.push(kind);
    if (out.length >= MAX_PINNED_ACHIEVEMENTS) break;
  }
  return out;
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

export function loadPinnedStreakKinds(): ProfileStreakKind[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizePinnedStreakKinds(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return [];
  }
}

/** @deprecated Use loadPinnedStreakKinds */
export function loadPinnedAchievementIds(): AchievementId[] {
  return loadPinnedStreakKinds().flatMap((kind) => {
    const match = ACHIEVEMENT_DEFINITIONS.find((def) => def.streakKind === kind);
    return match ? [match.id] : [];
  });
}

export function savePinnedStreakKinds(kinds: ProfileStreakKind[]): void {
  const earnedKinds = new Set(
    loadEarnedAchievements().map((row) => achievementIdToStreakKind(row.id)),
  );
  const unique = normalizePinnedStreakKinds(
    kinds.filter((kind) => earnedKinds.has(kind)).map((kind) => kind),
  );
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(unique));
  dispatchChanged();
}

/** @deprecated Use savePinnedStreakKinds */
export function savePinnedAchievementIds(ids: AchievementId[]): void {
  savePinnedStreakKinds(ids.map(achievementIdToStreakKind));
}

export function togglePinnedStreakKind(kind: ProfileStreakKind): ProfileStreakKind[] {
  const earnedKinds = new Set(
    loadEarnedAchievements().map((row) => achievementIdToStreakKind(row.id)),
  );
  if (!earnedKinds.has(kind)) return loadPinnedStreakKinds();

  const current = loadPinnedStreakKinds();
  const next = current.includes(kind)
    ? current.filter((x) => x !== kind)
    : current.length >= MAX_PINNED_ACHIEVEMENTS
      ? current
      : [...current, kind];
  savePinnedStreakKinds(next);
  return next;
}

/** @deprecated Use togglePinnedStreakKind */
export function togglePinnedAchievement(id: AchievementId): AchievementId[] {
  togglePinnedStreakKind(achievementIdToStreakKind(id));
  return loadPinnedAchievementIds();
}

export function buildPublicStreakSnapshot(
  kinds: ProfileStreakKind[],
  onsetDate?: string | null,
): Record<string, number> {
  const counts = computeAllProfileStreakDays(collectAllActivityEvents(), new Date(), onsetDate);
  const snapshot: Record<string, number> = {};
  for (const kind of kinds) {
    const days = counts[kind];
    if (days && days > 0) snapshot[kind] = days;
  }
  return snapshot;
}

export async function syncPinnedStreaksToProfile(
  userId: string,
  kinds?: ProfileStreakKind[],
): Promise<{ error: Error | null }> {
  const pinned = kinds ?? loadPinnedStreakKinds();
  savePinnedStreakKinds(pinned);
  const { getProfile, updateProfile } = await import("./profile");
  const { profile } = await getProfile(userId);
  const { error } = await updateProfile({
    id: userId,
    pinned_achievement_ids: pinned,
    public_streak_counts: buildPublicStreakSnapshot(pinned, profile?.diabetes_onset_date ?? null),
  });
  return { error };
}

/** @deprecated Use syncPinnedStreaksToProfile */
export async function syncPinnedAchievementsToProfile(
  userId: string,
  ids?: AchievementId[],
): Promise<{ error: Error | null }> {
  const kinds = ids ? normalizePinnedStreakKinds(ids) : loadPinnedStreakKinds();
  return syncPinnedStreaksToProfile(userId, kinds);
}

export async function syncPublicStreakCountsToProfile(userId: string): Promise<void> {
  const pinned = loadPinnedStreakKinds();
  if (pinned.length === 0) return;
  const { getProfile, updateProfile } = await import("./profile");
  const { profile } = await getProfile(userId);
  await updateProfile({
    id: userId,
    public_streak_counts: buildPublicStreakSnapshot(pinned, profile?.diabetes_onset_date ?? null),
  });
}

export async function loadPinnedStreaksFromProfile(userId: string): Promise<void> {
  const { getProfile } = await import("./profile");
  const { profile } = await getProfile(userId);
  if (!profile?.pinned_achievement_ids?.length) return;
  savePinnedStreakKinds(normalizePinnedStreakKinds(profile.pinned_achievement_ids));
}

/** @deprecated Use loadPinnedStreaksFromProfile */
export async function loadPinnedAchievementsFromProfile(userId: string): Promise<void> {
  await loadPinnedStreaksFromProfile(userId);
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

  if (newlyUnlocked.length === 0) {
    if (options?.userId) void syncPublicStreakCountsToProfile(options.userId);
    return [];
  }

  const now = new Date().toISOString();
  const merged = [...earned];
  for (const id of newlyUnlocked) {
    merged.push({ id, earnedAt: now });
  }
  saveEarnedAchievementsLocal(merged);

  if (options?.userId) {
    void pushAchievementsToCloud(options.userId, newlyUnlocked.map((id) => ({ id, earnedAt: now })));
    void syncPublicStreakCountsToProfile(options.userId);
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
export async function mergeCloudAchievements(
  userId: string,
  options?: { showToasts?: boolean },
): Promise<void> {
  await loadPinnedStreaksFromProfile(userId);

  const localBefore = new Set(loadEarnedAchievements().map((row) => row.id));
  const cloud = await fetchCloudAchievements(userId);
  const communityIds = new Set(
    ACHIEVEMENT_DEFINITIONS.filter((def) => def.communityAward).map((def) => def.id),
  );
  const cloudIds = new Set(cloud.map((row) => row.id));

  const local = loadEarnedAchievements().filter(
    (row) => !communityIds.has(row.id) || cloudIds.has(row.id),
  );
  if (cloud.length === 0) {
    if (local.length !== loadEarnedAchievements().length) {
      saveEarnedAchievementsLocal(local);
    }
    await syncPublicStreakCountsToProfile(userId);
    return;
  }
  const byId = new Map<string, EarnedAchievement>();
  for (const row of [...local, ...cloud]) {
    const prev = byId.get(row.id);
    if (!prev || row.earnedAt < prev.earnedAt) byId.set(row.id, row);
  }

  const merged = [...byId.values()].sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  saveEarnedAchievementsLocal(merged);

  const newlyFromCloud = merged.filter((row) => !localBefore.has(row.id));
  if (newlyFromCloud.length > 0 && options?.showToasts && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("diabeater:achievement-unlocked", {
        detail: { ids: newlyFromCloud.map((row) => row.id) },
      }),
    );
  }

  const missingOnCloud = merged.filter((row) => !cloud.some((c) => c.id === row.id));
  if (missingOnCloud.length > 0) {
    await pushAchievementsToCloud(userId, missingOnCloud);
  }

  await syncPublicStreakCountsToProfile(userId);
}

function parsePublicStreakCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isProfileStreakKind(key)) continue;
    const days = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(days) && days > 0) out[key] = Math.floor(days);
  }
  return out;
}

export function publicStreaksFromProfile(
  pinnedRaw: string[] | null | undefined,
  countsRaw: Record<string, number> | null | undefined,
): PublicProfileStreak[] {
  const pinned = normalizePinnedStreakKinds(pinnedRaw ?? []);
  if (pinned.length === 0) return [];

  const counts = parsePublicStreakCounts(countsRaw);
  return pinned
    .map((kind) => ({
      kind,
      days: counts[kind] ?? 0,
    }))
    .filter((row) => row.days > 0);
}

export async function fetchPublicProfileStreaks(
  userId: string,
  pinnedRaw: string[] | null | undefined,
  countsRaw: Record<string, number> | null | undefined,
): Promise<PublicProfileStreak[]> {
  const pinned = normalizePinnedStreakKinds(pinnedRaw ?? []);
  if (pinned.length === 0) return [];

  const local = publicStreaksFromProfile(pinned, countsRaw);
  if (local.length > 0) return local;

  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId);

    if (error || !data) return [];

    const earnedKinds = new Set<ProfileStreakKind>();
    for (const row of data) {
      const id = String((row as { achievement_id?: unknown }).achievement_id ?? "");
      if (!isAchievementId(id)) continue;
      earnedKinds.add(achievementIdToStreakKind(id));
    }

    return pinned
      .filter((kind) => earnedKinds.has(kind))
      .map((kind) => ({ kind, days: countsRaw?.[kind] ?? 0 }))
      .filter((row) => row.days > 0);
  } catch {
    return [];
  }
}

/** @deprecated Use fetchPublicProfileStreaks */
export async function fetchPublicProfileAchievements(
  userId: string,
  pinnedIds: string[] | null | undefined,
): Promise<PublicProfileAchievement[]> {
  return fetchPublicProfileStreaks(userId, pinnedIds, null);
}

/** @deprecated Use publicStreaksFromProfile */
export function publicAchievementsFromPinnedIds(pinnedIds: string[] | null | undefined): PublicProfileAchievement[] {
  return publicStreaksFromProfile(pinnedIds, null);
}

export function localPublicProfileStreaks(onsetDate?: string | null): PublicProfileStreak[] {
  const pinned = loadPinnedStreakKinds();
  return publicStreaksFromProfile(pinned, buildPublicStreakSnapshot(pinned, onsetDate));
}
