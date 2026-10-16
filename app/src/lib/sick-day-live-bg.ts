import { formatTargetBgInput } from "@/lib/hypo-context";
import type { BgUnits } from "@/lib/cgm/types";
import type { ExerciseBgTrend } from "@/lib/storage";

/** Same ketone-check threshold used in sick-day guidance (mg/dL). */
export const SICK_DAY_KETONE_CHECK_MGDL = 250;
const VERY_HIGH_MGDL = 300;
const CRITICAL_MGDL = 400;
/** Meaningful drift between live CGM and last logged reading (mg/dL). */
const DRIFT_MGDL = 36;

export type SickDayLiveBgTone = "ok" | "info" | "watch" | "urgent";

export type SickDayLiveBgCta = "update" | "ketones" | "connect" | null;

export type SickDayLiveBgNudge = {
  tone: SickDayLiveBgTone;
  title: string;
  detail: string;
  cta: SickDayLiveBgCta;
};

export function glucoseToMgdl(value: number, units: BgUnits): number {
  if (!Number.isFinite(value)) return NaN;
  return units === "mg/dL" ? value : value * 18;
}

function trendLabel(trend: ExerciseBgTrend | null | undefined): string | null {
  if (trend === "rising") return "rising";
  if (trend === "falling") return "falling";
  if (trend === "flat") return "steady";
  return null;
}

/**
 * Soft awareness copy for sick-day Now — never suggests a dose.
 * Returns null when there is nothing useful to show.
 */
export function resolveSickDayLiveBgNudge(input: {
  liveValue: number | null;
  liveUnits: BgUnits;
  trend?: ExerciseBgTrend | null;
  isStale?: boolean;
  hasLiveSource: boolean;
  loggedBg: number | null;
  loggedUnits: BgUnits;
}): SickDayLiveBgNudge | null {
  const { liveValue, liveUnits, hasLiveSource, loggedBg, loggedUnits } = input;
  const trend = input.trend ?? null;
  const isStale = Boolean(input.isStale);
  const rising = trend === "rising";
  const trendBit = trendLabel(trend);

  if (liveValue == null || !Number.isFinite(liveValue)) {
    if (!hasLiveSource) {
      return {
        tone: "info",
        title: "No live glucose yet",
        detail: "Connect a CGM to see your current reading here while you manage this sick day.",
        cta: "connect",
      };
    }
    return null;
  }

  const liveMgdl = glucoseToMgdl(liveValue, liveUnits);
  if (!Number.isFinite(liveMgdl)) return null;

  const liveLabel = `${formatTargetBgInput(liveValue, liveUnits)} ${liveUnits}`;
  const staleBit = isStale ? " Reading may be out of date." : "";

  if (liveMgdl >= CRITICAL_MGDL) {
    return {
      tone: "urgent",
      title: `Live glucose is very high (${liveLabel})`,
      detail: `Update your sick-day check and follow your clinic plan.${
        rising ? " Trend is rising." : ""
      }${staleBit} This does not change any dose on its own.`,
      cta: "update",
    };
  }

  if (liveMgdl >= VERY_HIGH_MGDL || (liveMgdl >= SICK_DAY_KETONE_CHECK_MGDL && rising)) {
    return {
      tone: "watch",
      title: rising ? "Live glucose high and rising" : `Live glucose is high (${liveLabel})`,
      detail: `Recheck ketones and log a fresh sick-day reading when you can.${staleBit}`,
      cta: "ketones",
    };
  }

  if (liveMgdl >= SICK_DAY_KETONE_CHECK_MGDL) {
    return {
      tone: "info",
      title: `Live glucose above ketone-check range (${liveLabel})`,
      detail: `Many plans say to test ketones when glucose stays this high.${
        trendBit ? ` Trend ${trendBit}.` : ""
      }${staleBit}`,
      cta: "ketones",
    };
  }

  if (loggedBg != null && Number.isFinite(loggedBg)) {
    const loggedMgdl = glucoseToMgdl(loggedBg, loggedUnits);
    if (Number.isFinite(loggedMgdl) && Math.abs(liveMgdl - loggedMgdl) >= DRIFT_MGDL) {
      return {
        tone: "info",
        title: "Live glucose has moved since your last log",
        detail: `Live is ${liveLabel}. Update readings if you want guidance to match what you see now.${staleBit}`,
        cta: "update",
      };
    }
  }

  if (isStale) {
    return {
      tone: "info",
      title: `Live glucose ${liveLabel}`,
      detail: "This reading looks a little old — refresh or log a check when you next test.",
      cta: "update",
    };
  }

  if (rising && liveMgdl >= 180) {
    return {
      tone: "info",
      title: `Live glucose ${liveLabel} · rising`,
      detail: "Keep an eye on your next check. Guidance still uses the readings you log — not this live stream alone.",
      cta: "update",
    };
  }

  return {
    tone: "ok",
    title: `Live glucose ${liveLabel}`,
    detail: trendBit
      ? `Trend ${trendBit}. Keep checking on your sick-day schedule.`
      : "Keep checking on your sick-day schedule.",
    cta: null,
  };
}
