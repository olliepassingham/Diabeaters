import { normalizeBgUnits, isBgLow, isBgVeryHigh } from "@/lib/alcohol-night-tool";

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
  /** True if user had a hypo or hypo-like symptoms in the last few hours */
  recentHypoOrSymptoms: boolean;
  /** User feels alert enough to concentrate safely */
  alertEnough: boolean;
  /** Fast-acting carbs / treatment within reach (e.g. in the vehicle) */
  treatmentInReach: boolean;
  /** Adds one short tip about breaks — does not change safety tier */
  longJourney: boolean;
};

export type DrivingReadinessLinks = {
  hypoHelp: boolean;
  helpNow: boolean;
  emergencyCard: boolean;
};

export type DrivingReadinessOutcome =
  | {
      kind: "not_ready";
      headline: string;
      lead: string;
      bullets: string[];
      links: DrivingReadinessLinks;
    }
  | {
      kind: "caution";
      headline: string;
      lead: string;
      bullets: string[];
      links: DrivingReadinessLinks;
    }
  | {
      kind: "likely_ok";
      headline: string;
      lead: string;
      bullets: string[];
      disclaimer: string;
      links: DrivingReadinessLinks;
    };

const LINKS_HYPO: DrivingReadinessLinks = { hypoHelp: true, helpNow: false, emergencyCard: true };
const LINKS_URGENT: DrivingReadinessLinks = { hypoHelp: true, helpNow: true, emergencyCard: true };
const LINKS_NONE: DrivingReadinessLinks = { hypoHelp: false, helpNow: false, emergencyCard: false };

function appendLongJourney(bullets: string[], longJourney: boolean): string[] {
  if (!longJourney) return bullets;
  return [
    ...bullets,
    "On longer trips, plan breaks and keep checks and snacks within reach — not only in the boot.",
  ];
}

/**
 * Priority: not safe to concentrate / recent hypo / BG low or very high → not_ready.
 * Missing BG never yields likely_ok (cap at caution).
 * Falling trend when in range → caution.
 */
export function buildDrivingReadinessOutcome(
  input: DrivingReadinessInput,
  profileBgUnits: string | undefined,
): DrivingReadinessOutcome {
  const u = normalizeBgUnits(profileBgUnits);

  if (!input.alertEnough) {
    return {
      kind: "not_ready",
      headline: "Not ready to drive",
      lead: "Based on what you entered, you don’t feel alert enough to concentrate safely.",
      bullets: appendLongJourney(
        [
          "Do not drive until you feel fully able to focus — rest, treat lows, or get help as your team advises.",
          "If symptoms are severe or worsening, use your emergency plan or seek urgent care.",
        ],
        input.longJourney,
      ),
      links: LINKS_URGENT,
    };
  }

  if (input.recentHypoOrSymptoms) {
    return {
      kind: "not_ready",
      headline: "Not ready to drive yet",
      lead: "You indicated a recent hypo or hypo-like symptoms. Many teams advise waiting after lows before driving.",
      bullets: appendLongJourney(
        [
          "Confirm with your care team how long to wait after a hypo before driving.",
          "Do not drive until you and (if possible) someone with you agree you have fully recovered.",
        ],
        input.longJourney,
      ),
      links: LINKS_HYPO,
    };
  }

  if (!input.bgSkipped && input.bgValue != null) {
    if (isBgLow(input.bgValue, u)) {
      return {
        kind: "not_ready",
        headline: "Treat glucose first",
        lead: `Your entered reading is below the app’s “low” threshold (${u === "mg/dL" ? "under 72" : "under 4"} ${u}) — not a legal limit.`,
        bullets: appendLongJourney(
          [
            "Treat with fast-acting carbohydrate as your team taught you, then recheck.",
            "Only drive again when you are safely back in range and feel well enough to concentrate.",
          ],
          input.longJourney,
        ),
        links: LINKS_HYPO,
      };
    }
    if (isBgVeryHigh(input.bgValue, u)) {
      return {
        kind: "not_ready",
        headline: "Not ready to drive",
        lead: `Your entered reading is very high (${u === "mg/dL" ? "above 252" : "above 14"} ${u}). Illness, ketones, or feeling unwell can make driving unsafe.`,
        bullets: appendLongJourney(
          [
            "Follow your sick-day or high-glucose plan and contact your team if unsure.",
            "If you feel unwell, confused, or have ketone concerns, do not drive — seek advice.",
          ],
          input.longJourney,
        ),
        links: LINKS_URGENT,
      };
    }
  }

  if (!input.treatmentInReach) {
    return {
      kind: "caution",
      headline: "Fix this before driving",
      lead: "Fast-acting carbohydrate should be within reach before you set off.",
      bullets: appendLongJourney(
        ["Move hypo treatment into the passenger area so you can use it without leaving your seat if safe to do so."],
        input.longJourney,
      ),
      links: LINKS_HYPO,
    };
  }

  if (input.bgSkipped) {
    return {
      kind: "caution",
      headline: "Check glucose before you drive",
      lead: "We can’t confirm you’re in range without a reading. This isn’t a legal rule — use your team’s targets.",
      bullets: appendLongJourney(
        [
          "Do a check your clinic recommends (often a fingerstick if you use insulin).",
          "Come back here after you have a number if you want a quick follow-up.",
        ],
        input.longJourney,
      ),
      links: LINKS_NONE,
    };
  }

  // In-range BG but falling: extra caution (same low/very-high thresholds as elsewhere in the app).
  if (input.bgValue != null && input.bgTrend === "falling") {
    return {
      kind: "caution",
      headline: "Use extra caution",
      lead: "Your reading is in range, but glucose may still be heading down.",
      bullets: appendLongJourney(
        [
          "Consider delaying the journey or rechecking before you go, per your clinic.",
          "Keep treatment within reach and pull over if you feel any hypo symptoms.",
        ],
        input.longJourney,
      ),
      links: LINKS_HYPO,
    };
  }

  return {
    kind: "likely_ok",
    headline: "Likely OK to drive",
    lead: "Based on what you entered — not medical or legal advice. Follow local rules and your clinic.",
    bullets: appendLongJourney(
      [
        "Still pull over immediately if you feel hypo or unwell.",
        "CGM arrows can lag; use finger checks when your team or local rules say to.",
      ],
      input.longJourney,
    ),
    disclaimer:
      "This tool does not know legal driving limits. Stop driving if you feel unsafe, and follow your care team’s plan.",
    links: LINKS_NONE,
  };
}
