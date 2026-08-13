/**
 * Supporter Situations copy for shared bedtime checks — reassurance-level only.
 * BG from the check is shown only when live glucose sharing is on for the link.
 * Never surfaces carbs or dose suggestions.
 */

export type BedtimeSituationDetailOptions = {
  /** True when the patient has shared live glucose with this supporter. */
  includeBg?: boolean;
};

function bedtimeInputsSummary(
  rawState: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!rawState) return null;
  const summary = rawState.inputs_summary;
  if (!summary || typeof summary !== "object") return null;
  return summary as Record<string, unknown>;
}

/** Format bedtime check BG for supporters when live glucose is shared. */
export function formatBedtimeSharedBg(summary: Record<string, unknown> | null | undefined): string | null {
  if (!summary) return null;
  const bg = summary.bg;
  if (typeof bg !== "number" || !Number.isFinite(bg)) return null;
  const unitsRaw = typeof summary.bg_units === "string" ? summary.bg_units.trim() : "";
  const units = unitsRaw === "mg/dL" || unitsRaw === "mmol/L" ? unitsRaw : null;
  if (!units) return null;
  const display =
    units === "mg/dL" ? String(Math.round(bg)) : String(Math.round(bg * 10) / 10);
  return `${display} ${units}`;
}

/** Short detail when the linked person completed a bedtime check that was not fully steady. */
export function bedtimeAttentionDetail(
  rawState: Record<string, unknown> | null | undefined,
  options?: BedtimeSituationDetailOptions,
): string | undefined {
  if (!rawState || rawState.bedtime_ready === true) return undefined;

  const summary = bedtimeInputsSummary(rawState);
  const bgLabel = options?.includeBg ? formatBedtimeSharedBg(summary) : null;

  const level = typeof rawState.readiness_level === "string" ? rawState.readiness_level.trim() : "";
  if (level === "alert") {
    return bgLabel
      ? `Higher overnight risk noted at check-in · ${bgLabel}`
      : "Higher overnight risk noted at check-in";
  }
  if (level === "monitor") {
    return bgLabel
      ? `They noted this was worth watching overnight · ${bgLabel}`
      : "They noted this was worth watching overnight";
  }

  if (!summary) {
    return bgLabel ? `They completed a bedtime check · ${bgLabel}` : "They completed a bedtime check";
  }

  const bits: string[] = [];
  if (bgLabel) bits.push(bgLabel);
  if (summary.recent_hypos === true) bits.push("recent hypo");
  if (summary.had_alcohol === true) bits.push("alcohol");
  if (summary.trend === "falling") bits.push("falling BG");
  if (summary.exercised_today === true) bits.push("exercise today");
  if (bits.length > 0) return bits.slice(0, bgLabel ? 3 : 2).join(" · ");
  return "They completed a bedtime check";
}

/** Calm reassurance when their bedtime check came back Ready. */
export function bedtimeReadyDetail(
  rawState: Record<string, unknown> | null | undefined,
  options?: BedtimeSituationDetailOptions,
): string | undefined {
  if (!rawState || rawState.bedtime_ready !== true) return undefined;

  const summary = bedtimeInputsSummary(rawState);
  const bgLabel = options?.includeBg ? formatBedtimeSharedBg(summary) : null;
  const bits: string[] = [];
  if (bgLabel) bits.push(bgLabel);
  if (summary?.trend === "flat") bits.push("flat trend");
  if (summary?.recent_hypos === false) bits.push("no recent hypo");
  if (summary?.had_alcohol === false) bits.push("no alcohol");

  const maxBits = bgLabel ? 2 : 2;
  if (bits.length > 0) {
    return `Overnight looks steady · ${bits.slice(0, maxBits).join(" · ")}`;
  }
  return "Overnight looks steady";
}

export function bedtimeSituationDetail(
  rawState: Record<string, unknown> | null | undefined,
  ready: boolean,
  options?: BedtimeSituationDetailOptions,
): string | undefined {
  return ready ? bedtimeReadyDetail(rawState, options) : bedtimeAttentionDetail(rawState, options);
}
