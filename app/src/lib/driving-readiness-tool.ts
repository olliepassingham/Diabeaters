import { normalizeBgUnits, isBgLow, isBgVeryHigh } from "@/lib/alcohol-night-tool";
import {
  formatPrimaryTreatmentShort,
  type PrimaryHypoTreatment,
} from "@/lib/hypo-treatment-display";
import { isExerciseStartLow } from "@/lib/exercise-reading-guidance";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { UserSettings } from "@/lib/storage";

/**
 * Quick driving readiness — heuristic only. Does not encode legal limits;
 * always follow local licensing rules and your clinic.
 */

export type DrivingTrend = "rising" | "flat" | "falling" | "unknown";

export type DrivingReadinessInput = {
  bgSkipped: boolean;
  bgValue: number | null;
  /** Ignored when bgSkipped */
  bgTrend: DrivingTrend | null;
  recentHypoOrSymptoms: boolean;
  alertEnough: boolean;
  treatmentInReach: boolean;
  longJourney: boolean;
};

export type DrivingReadinessContext = {
  settings?: UserSettings;
  primaryHypoTreatment?: PrimaryHypoTreatment;
  isPump?: boolean;
};

export type DrivingReadinessLinks = {
  hypoHelp: boolean;
  helpNow: boolean;
  emergencyCard: boolean;
};

type DrivingOutcomeBase = {
  headline: string;
  lead: string;
  doNow: string[];
  beforeYouGo: string[];
  detailsForInfo: string[];
  links: DrivingReadinessLinks;
  readingSummary?: string;
};

export type DrivingReadinessOutcome =
  | ({ kind: "not_ready" } & DrivingOutcomeBase)
  | ({ kind: "caution" } & DrivingOutcomeBase)
  | ({ kind: "likely_ok"; disclaimer: string } & DrivingOutcomeBase);

const LINKS_HYPO: DrivingReadinessLinks = { hypoHelp: true, helpNow: false, emergencyCard: true };
const LINKS_URGENT: DrivingReadinessLinks = { hypoHelp: true, helpNow: true, emergencyCard: true };
const LINKS_NONE: DrivingReadinessLinks = { hypoHelp: false, helpNow: false, emergencyCard: false };

const HYPO_TREATMENT_GRAMS = 15;

function appendLongJourney(bullets: string[], longJourney: boolean): string[] {
  if (!longJourney) return bullets;
  return [
    ...bullets,
    "On longer trips, plan breaks every 1–2 hours and keep checks and snacks within reach — not only in the boot.",
  ];
}

function formatReadingSummary(
  bg: number | null,
  trend: DrivingTrend | null,
  u: "mmol/L" | "mg/dL",
  skipped: boolean,
): string | undefined {
  if (skipped || bg == null) return undefined;
  const trendLabel =
    trend === "falling" ? "falling" : trend === "rising" ? "rising" : trend === "flat" ? "stable" : null;
  const base = `${formatTargetBgInput(bg, u)} ${u}`;
  return trendLabel ? `${base} · ${trendLabel}` : base;
}

function isBelowUserTargetLow(bg: number, settings: UserSettings | undefined, u: "mmol/L" | "mg/dL"): boolean {
  const low = settings?.targetBgLow;
  if (typeof low !== "number" || low <= 0) return false;
  if (isBgLow(bg, u)) return false;
  return bg < low;
}

function treatmentDoNowLine(treatment: PrimaryHypoTreatment | undefined): string {
  const hint = formatPrimaryTreatmentShort(HYPO_TREATMENT_GRAMS, treatment);
  if (hint) return `Treat with ${hint} as your team taught you, wait about 15 minutes, then recheck.`;
  return "Treat with fast-acting carbohydrate as your team taught you, wait about 15 minutes, then recheck.";
}

function treatmentInCarLine(treatment: PrimaryHypoTreatment | undefined): string {
  const hint = formatPrimaryTreatmentShort(HYPO_TREATMENT_GRAMS, treatment);
  if (hint) return `Put ${hint} where you can reach them without leaving your seat (passenger footwell is fine).`;
  return "Keep fast-acting carbs in the passenger area — not only in the boot.";
}

function buildInfoDetails(
  u: "mmol/L" | "mg/dL",
  settings: UserSettings | undefined,
  isPump: boolean,
): string[] {
  const lines: string[] = [
    "This tool does not state legal blood-glucose limits for driving. Follow local licensing rules, road authority guidance, and your diabetes clinic.",
    "CGM arrows can lag behind finger readings — use checks your team or local rules require before driving.",
  ];
  const low = settings?.targetBgLow;
  const high = settings?.targetBgHigh;
  if (typeof low === "number" && typeof high === "number" && low > 0 && high >= low) {
    lines.push(
      `Your saved target range is ${formatTargetBgInput(low, u)}–${formatTargetBgInput(high, u)} ${u}. This check uses app safety thresholds too, not only your range.`,
    );
  }
  if (isPump) {
    lines.push(
      "On a pump: check insulin on board, any active temp basal, and that pump/CGM alarms are set how your team recommends.",
    );
  }
  lines.push("Stop driving immediately if you feel hypo, confused, or unwell — pull over when safe.");
  return lines;
}

function outcome(
  kind: DrivingReadinessOutcome["kind"],
  base: DrivingOutcomeBase,
  disclaimer?: string,
): DrivingReadinessOutcome {
  if (kind === "likely_ok") {
    return { kind, ...base, disclaimer: disclaimer ?? "" };
  }
  return { kind, ...base };
}

/**
 * Priority: not safe to concentrate / recent hypo / BG low or very high → not_ready.
 * Missing BG never yields likely_ok (cap at caution).
 * Falling trend or below personal target → caution when otherwise in app range.
 */
export function buildDrivingReadinessOutcome(
  input: DrivingReadinessInput,
  profileBgUnits: string | undefined,
  context: DrivingReadinessContext = {},
): DrivingReadinessOutcome {
  const u = normalizeBgUnits(profileBgUnits);
  const { settings, primaryHypoTreatment, isPump = false } = context;
  const readingSummary = formatReadingSummary(
    input.bgValue,
    input.bgSkipped ? null : input.bgTrend,
    u,
    input.bgSkipped,
  );
  const infoDetails = buildInfoDetails(u, settings, isPump);

  if (!input.alertEnough) {
    return outcome("not_ready", {
      headline: "Not ready to drive",
      lead: "You don’t feel alert enough to concentrate safely.",
      doNow: ["Do not drive — rest, treat lows, or get help as your team advises."],
      beforeYouGo: appendLongJourney(
        ["When you feel fully alert again, run this check or recheck glucose before you set off."],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_URGENT,
      readingSummary,
    });
  }

  if (input.recentHypoOrSymptoms) {
    return outcome("not_ready", {
      headline: "Not ready to drive yet",
      lead: "You reported a recent hypo or hypo-like symptoms.",
      doNow: ["Do not drive until you have fully recovered and feel able to focus."],
      beforeYouGo: appendLongJourney(
        [
          "Many teams advise waiting about 45–60 minutes after a treated hypo before driving — confirm your clinic’s rule.",
          "Recheck glucose and run this check again before you go.",
        ],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_HYPO,
      readingSummary,
    });
  }

  if (!input.bgSkipped && input.bgValue != null) {
    if (isBgLow(input.bgValue, u)) {
      return outcome("not_ready", {
        headline: "Treat glucose first",
        lead: `Reading is below the app’s low threshold (under ${u === "mg/dL" ? "72" : "4"} ${u}) — not a legal limit.`,
        doNow: [treatmentDoNowLine(primaryHypoTreatment), "Only drive after you are back in range and feel well."],
        beforeYouGo: appendLongJourney(
          ["Run this check again after you recheck.", treatmentInCarLine(primaryHypoTreatment)],
          input.longJourney,
        ),
        detailsForInfo: infoDetails,
        links: LINKS_HYPO,
        readingSummary,
      });
    }
    if (isBgVeryHigh(input.bgValue, u)) {
      return outcome("not_ready", {
        headline: "Not ready to drive",
        lead: `Reading is very high (above ${u === "mg/dL" ? "252" : "14"} ${u}). Illness, ketones, or feeling unwell can make driving unsafe.`,
        doNow: ["Do not drive — follow your sick-day or high-glucose plan and contact your team if unsure."],
        beforeYouGo: appendLongJourney(
          ["If you feel unwell, confused, or have ketone concerns, seek advice before driving."],
          input.longJourney,
        ),
        detailsForInfo: infoDetails,
        links: LINKS_URGENT,
        readingSummary,
      });
    }
  }

  if (!input.treatmentInReach) {
    return outcome("caution", {
      headline: "Fix this before driving",
      lead: "Fast-acting carbohydrate should be within reach before you set off.",
      doNow: [treatmentInCarLine(primaryHypoTreatment)],
      beforeYouGo: appendLongJourney(
        ["Then run this check again if you want a quick follow-up."],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_HYPO,
      readingSummary,
    });
  }

  if (input.bgSkipped) {
    return outcome("caution", {
      headline: "Check glucose before you drive",
      lead: "We can’t confirm you’re in range without a reading.",
      doNow: ["Do a check your clinic recommends (often a fingerstick if you use insulin)."],
      beforeYouGo: appendLongJourney(
        ["Come back here after you have a number for a quick follow-up."],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_NONE,
    });
  }

  const bg = input.bgValue!;

  if (isBelowUserTargetLow(bg, settings, u)) {
    return outcome("caution", {
      headline: "Below your target range",
      lead: `Your reading is under your saved target low (${formatTargetBgInput(settings!.targetBgLow!, u)} ${u}) — many people wait until they are back in their usual range.`,
      doNow: [
        input.bgTrend === "falling"
          ? "Glucose may still be dropping — treat or snack if your team advises, then recheck before you go."
          : "Consider a small correction or snack per your team’s plan, then recheck.",
      ],
      beforeYouGo: appendLongJourney(
        ["Keep treatment within reach and pull over if you feel any hypo symptoms."],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_HYPO,
      readingSummary,
    });
  }

  if (isExerciseStartLow(bg, u) && !isBgLow(bg, u)) {
    return outcome("caution", {
      headline: "Use extra caution",
      lead: `Reading is below a typical comfort band for many drivers (${u === "mmol/L" ? "under 5.6" : "under 100"} ${u}) but above the app’s “low” cutoff.`,
      doNow: ["Consider a small carb top-up or recheck in 10–15 minutes if you feel unsure."],
      beforeYouGo: appendLongJourney(
        [
          input.bgTrend === "falling"
            ? "Trend is falling — delaying the journey or rechecking first is often wise."
            : "Keep treatment within reach during the trip.",
        ],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_HYPO,
      readingSummary,
    });
  }

  if (input.bgTrend === "falling") {
    return outcome("caution", {
      headline: "Use extra caution",
      lead: "Your reading is in range, but glucose may still be heading down.",
      doNow: ["Consider delaying the journey or rechecking in about 15 minutes."],
      beforeYouGo: appendLongJourney(
        ["Keep treatment within reach and pull over if you feel any hypo symptoms."],
        input.longJourney,
      ),
      detailsForInfo: infoDetails,
      links: LINKS_HYPO,
      readingSummary,
    });
  }

  const beforeYouGo: string[] = ["Pull over immediately if you feel hypo or unwell during the trip."];
  if (input.bgTrend === "rising") {
    beforeYouGo.push("BG is rising — still watch for a later dip, especially after recent insulin or exercise.");
  } else {
    beforeYouGo.push("Use finger checks when your team or local rules say to, even if CGM looks fine.");
  }

  return outcome(
    "likely_ok",
    {
      headline: "Likely OK to drive",
      lead: "Based on what you entered — not medical or legal advice. Follow local rules and your clinic.",
      doNow: [],
      beforeYouGo: appendLongJourney(beforeYouGo, input.longJourney),
      detailsForInfo: infoDetails,
      links: LINKS_NONE,
      readingSummary,
    },
    "This tool does not know legal driving limits. Stop driving if you feel unsafe, and follow your care team’s plan.",
  );
}
