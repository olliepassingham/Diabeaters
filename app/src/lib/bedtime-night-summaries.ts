import { toBedtimeStreakDayKey } from "@/lib/bedtime-overnight-window";
import { isOnline } from "@/lib/offline";
import { getSupabase } from "@/lib/supabase";
import type { BedtimeLog, BedtimeOvernightCgmSummary } from "@/lib/storage";

export type BedtimeNightSummaryRecord = {
  streakDay: string;
  inRangePercent: number;
  hadLow: boolean;
  hadHigh: boolean;
  readingCount: number;
  windowStart: string;
  windowEnd: string;
  headline: string;
  computedAt: string;
};

const CLOUD_NIGHT_ID_PREFIX = "cloud-night-";

export function isCloudOnlyBedtimeLog(logId: string): boolean {
  return logId.startsWith(CLOUD_NIGHT_ID_PREFIX);
}

type CloudRow = {
  streak_day: string;
  in_range_percent: number;
  had_low: boolean;
  had_high: boolean;
  reading_count: number;
  window_start: string;
  window_end: string;
  headline: string;
  computed_at: string;
};

function summaryFromRecord(row: BedtimeNightSummaryRecord): BedtimeOvernightCgmSummary {
  return {
    inRangePercent: row.inRangePercent,
    readingCount: row.readingCount,
    hadLow: row.hadLow,
    hadHigh: row.hadHigh,
    computedAt: row.computedAt,
  };
}

function logFromCloudNight(row: BedtimeNightSummaryRecord): BedtimeLog {
  return {
    id: `${CLOUD_NIGHT_ID_PREFIX}${row.streakDay}`,
    date: row.windowStart,
    currentBg: 0,
    bgUnits: "mmol/L",
    readinessLevel: "steady",
    hoursSinceFood: null,
    hoursSinceInsulin: null,
    hoursUntilSleep: 0,
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
    travelModeActive: false,
    correctionGiven: null,
    notes: "",
    overnightCgmSummary: summaryFromRecord(row),
  };
}

/** Fill missing local percents and add nights that only exist on the account. */
export function mergeCloudNightSummaries(
  logs: BedtimeLog[],
  cloud: BedtimeNightSummaryRecord[],
): BedtimeLog[] {
  if (cloud.length === 0) return logs;
  const next = logs.map((log) => ({ ...log }));
  const indexByDay = new Map<string, number>();
  next.forEach((log, index) => {
    const day = toBedtimeStreakDayKey(log.date, log.hoursUntilSleep);
    if (day && !indexByDay.has(day)) indexByDay.set(day, index);
  });

  for (const row of cloud) {
    if (!row.streakDay || row.readingCount <= 0) continue;
    const existing = indexByDay.get(row.streakDay);
    if (existing != null) {
      const log = next[existing];
      if (log && !log.overnightCgmSummary) {
        next[existing] = { ...log, overnightCgmSummary: summaryFromRecord(row) };
      }
      continue;
    }
    next.push(logFromCloudNight(row));
    indexByDay.set(row.streakDay, next.length - 1);
  }
  return next;
}

function fromCloudRow(row: CloudRow): BedtimeNightSummaryRecord | null {
  if (!row.streak_day || !Number.isFinite(row.in_range_percent)) return null;
  return {
    streakDay: String(row.streak_day).slice(0, 10),
    inRangePercent: Math.round(row.in_range_percent),
    hadLow: Boolean(row.had_low),
    hadHigh: Boolean(row.had_high),
    readingCount: row.reading_count,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    headline: row.headline || "Last night",
    computedAt: row.computed_at,
  };
}

export async function listBedtimeNightSummaries(): Promise<BedtimeNightSummaryRecord[]> {
  if (!isOnline()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabase
    .from("bedtime_night_summaries")
    .select(
      "streak_day, in_range_percent, had_low, had_high, reading_count, window_start, window_end, headline, computed_at",
    )
    .eq("user_id", userData.user.id)
    .order("streak_day", { ascending: false })
    .limit(14);

  if (error || !data) return [];
  return (data as CloudRow[]).map(fromCloudRow).filter((row): row is BedtimeNightSummaryRecord => row != null);
}

export async function rememberBedtimeNightOnAccount(row: BedtimeNightSummaryRecord): Promise<void> {
  if (!isOnline() || row.readingCount <= 0 || !row.streakDay) return;
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return;

  const { error } = await supabase.from("bedtime_night_summaries").upsert(
    {
      user_id: userData.user.id,
      streak_day: row.streakDay,
      in_range_percent: Math.round(row.inRangePercent),
      had_low: row.hadLow,
      had_high: row.hadHigh,
      reading_count: row.readingCount,
      window_start: row.windowStart,
      window_end: row.windowEnd,
      headline: row.headline.slice(0, 120),
      computed_at: row.computedAt,
    },
    { onConflict: "user_id,streak_day" },
  );
  if (error && import.meta.env.DEV) {
    console.warn("bedtime night summary: save failed", error);
  }
}
