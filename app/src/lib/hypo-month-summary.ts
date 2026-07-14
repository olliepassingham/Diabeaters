import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { HypoTreatment } from "@/lib/storage";

export type HypoMonthSummary = {
  thisMonthCount: number;
  lastMonthCount: number;
  /** lastMonth − thisMonth; positive means fewer this month. */
  reduction: number;
};

export function getHypoMonthSummary(
  treatments: HypoTreatment[],
  now: Date = new Date(),
): HypoMonthSummary {
  const thisStart = startOfMonth(now).getTime();
  const thisEnd = endOfMonth(now).getTime();
  const lastStart = startOfMonth(subMonths(now, 1)).getTime();
  const lastEnd = endOfMonth(subMonths(now, 1)).getTime();

  let thisMonthCount = 0;
  let lastMonthCount = 0;
  for (const row of treatments) {
    const t = new Date(row.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= thisStart && t <= thisEnd) thisMonthCount += 1;
    else if (t >= lastStart && t <= lastEnd) lastMonthCount += 1;
  }

  return {
    thisMonthCount,
    lastMonthCount,
    reduction: lastMonthCount - thisMonthCount,
  };
}

export function formatHypoMonthSummaryLine(summary: HypoMonthSummary): string {
  const { thisMonthCount, lastMonthCount, reduction } = summary;
  if (thisMonthCount === 0 && lastMonthCount === 0) {
    return "No logged hypos this month or last month.";
  }
  const thisLabel = `${thisMonthCount} logged this month`;
  if (lastMonthCount === 0) {
    return `${thisLabel} · none logged last month.`;
  }
  if (reduction > 0) {
    return `${thisLabel} · ${reduction} fewer than last month (${lastMonthCount}).`;
  }
  if (reduction < 0) {
    return `${thisLabel} · ${Math.abs(reduction)} more than last month (${lastMonthCount}).`;
  }
  return `${thisLabel} · same as last month (${lastMonthCount}).`;
}
