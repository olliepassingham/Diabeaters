/** Community tenure badges — longest / shortest reported time with type 1 diabetes. */

export const DIABETES_TENURE_LONGEST_KIND = "diabetes_tenure_longest" as const;
export const DIABETES_TENURE_SHORTEST_KIND = "diabetes_tenure_shortest" as const;

export const DIABETES_TENURE_KINDS = [
  DIABETES_TENURE_LONGEST_KIND,
  DIABETES_TENURE_SHORTEST_KIND,
] as const;

export type DiabetesTenureKind = (typeof DIABETES_TENURE_KINDS)[number];

export function isDiabetesTenureKind(value: string): value is DiabetesTenureKind {
  return (DIABETES_TENURE_KINDS as readonly string[]).includes(value);
}

export type TenureEligibleProfile = {
  id: string;
  diabetes_onset_date: string | null | undefined;
  is_public?: boolean | null;
};

/** Parse YYYY-MM-DD to local midnight Date; null when invalid or in the future. */
export function parseOnsetDateLocal(isoDate: string | null | undefined, today: Date = new Date()): Date | null {
  if (!isoDate?.trim()) return null;
  const parts = isoDate.trim().split("-").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return null;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  if (start > t) return null;
  return start;
}

/** Whole days since onset (local calendar). */
export function computeTenureDaysSinceOnset(
  isoDate: string | null | undefined,
  today: Date = new Date(),
): number {
  const start = parseOnsetDateLocal(isoDate, today);
  if (!start) return 0;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const ms = t.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function formatTenureBadgeLabel(days: number): string {
  if (days <= 0) return "—";
  const years = Math.floor(days / 365.25);
  if (years >= 1) return `~${years}y`;
  const months = Math.floor(days / 30.44);
  if (months >= 1) return `~${months}mo`;
  return `${days}d`;
}

export type TenureHolderResult = {
  longestUserIds: string[];
  shortestUserIds: string[];
  /** Fewer than two distinct eligible onset dates — no titles awarded. */
  awardsActive: boolean;
};

/**
 * Pick community tenure holders from public profiles with a valid onset date.
 * Longest = earliest onset; shortest = latest onset. Ties share the title.
 */
export function resolveTenureHolders(
  profiles: TenureEligibleProfile[],
  today: Date = new Date(),
): TenureHolderResult {
  const eligible = profiles
    .filter((p) => p.is_public !== false && p.id && p.diabetes_onset_date?.trim())
    .map((p) => ({
      id: p.id,
      onset: p.diabetes_onset_date!.trim(),
      start: parseOnsetDateLocal(p.diabetes_onset_date, today),
    }))
    .filter((row): row is { id: string; onset: string; start: Date } => row.start != null);

  if (eligible.length < 2) {
    return { longestUserIds: [], shortestUserIds: [], awardsActive: false };
  }

  const distinctOnsets = [...new Set(eligible.map((row) => row.onset))];
  if (distinctOnsets.length < 2) {
    return { longestUserIds: [], shortestUserIds: [], awardsActive: false };
  }

  const minOnset = distinctOnsets.reduce((a, b) => (a < b ? a : b));
  const maxOnset = distinctOnsets.reduce((a, b) => (a > b ? a : b));

  return {
    longestUserIds: eligible.filter((row) => row.onset === minOnset).map((row) => row.id),
    shortestUserIds: eligible.filter((row) => row.onset === maxOnset).map((row) => row.id),
    awardsActive: true,
  };
}
