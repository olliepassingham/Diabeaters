import type { UserSettings } from "@/lib/storage";
import { calculateMealDose, insulinRoundIncrement, type MealDoseResult } from "@/lib/meal-dose";
import {
  normalizeBgUnits,
  isBgLow,
  type AlcoholIntensity,
  type AlcoholRedFlags,
  type AlcoholTrend,
} from "@/lib/alcohol-night-tool";
import { buildAlcoholDoseGuidance, type AlcoholDoseGuidance } from "@/lib/alcohol-dose-guidance";

export type AlcoholSituationKind = "meal_with_drinks" | "late_snack" | "before_out" | "feels_wrong";

export type AlcoholSituationInput = {
  situation: AlcoholSituationKind;
  redFlags: AlcoholRedFlags;
  bgSkipped: boolean;
  bgValue: number | null;
  bgTrend: AlcoholTrend | null;
  drinkingIntensity: AlcoholIntensity;
  /** Total carb grams (meal planner parity with Adviser when carb unit is grams). */
  carbsG: number | null;
  /** breakfast | lunch | dinner | snack */
  mealType: string;
  isPump?: boolean;
};

export type AlcoholSituationLinks = {
  hypoHelp: boolean;
  sickDay: boolean;
  helpNow: boolean;
};

export type AlcoholSituationOutcome =
  | {
      kind: "urgent";
      headline: string;
      lead: string;
      bullets: string[];
      links: AlcoholSituationLinks;
    }
  | {
      kind: "hypo_first";
      headline: string;
      lead: string;
      bullets: string[];
      links: AlcoholSituationLinks;
    }
  | {
      kind: "estimate";
      meal: MealDoseResult;
      alcoholGuidance: AlcoholDoseGuidance;
      tips: string[];
      disclaimer: string;
    }
  | {
      kind: "prep_only";
      headline: string;
      tips: string[];
      checklist: string[];
    }
  | {
      kind: "needs_ratios";
      message: string;
    }
  | {
      kind: "needs_carbs";
      message: string;
    }
  | {
      kind: "feels_ok";
      headline: string;
      body: string;
      links: AlcoholSituationLinks;
    };

function redFlagActive(flags: AlcoholRedFlags): boolean {
  return (
    flags.vomiting ||
    flags.severeAbdominalPain ||
    flags.confusion ||
    flags.veryHighBgOrKetones ||
    flags.cantKeepFluids
  );
}

function hypoGateActive(
  bgSkipped: boolean,
  bgValue: number | null,
  bgTrend: AlcoholTrend | null,
  intensity: AlcoholIntensity,
  bgUnits: "mmol/L" | "mg/dL",
): boolean {
  if (bgSkipped || bgValue == null) return false;
  const trend = bgTrend || "unknown";
  if (isBgLow(bgValue, bgUnits)) return true;
  if (!isBgLow(bgValue, bgUnits) && trend === "falling" && intensity !== "light") return true;
  return false;
}

const URGENT: AlcoholSituationOutcome = {
  kind: "urgent",
  headline: "Get medical help or contact your team now",
  lead: "You indicated symptoms or signs that can be serious with type 1 diabetes. Do not rely on this app — use your emergency plan.",
  bullets: [
    "If you are vomiting repeatedly, cannot keep fluids down, or feel confused, seek urgent care or call your local emergency number if advised.",
    "High glucose with ketones, or severe abdominal pain, needs urgent assessment — not wait until tomorrow.",
    "If in doubt, it is safer to be checked than to stay home.",
  ],
  links: { hypoHelp: true, sickDay: true, helpNow: true },
};

function hypoOutcome(bgValue: number | null, bgUnits: "mmol/L" | "mg/dL"): AlcoholSituationOutcome {
  const uLabel = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const lead =
    bgValue != null && isBgLow(bgValue, bgUnits)
      ? `Your entered BG (${bgValue} ${uLabel}) is in a range where drinking is unsafe until you have treated and recovered per your team's hypo plan.`
      : "A falling glucose pattern plus alcohol can lead to lows later. Confirm you are in a safe range and feeling well before drinking.";
  return {
    kind: "hypo_first",
    headline: "Treat glucose first — do not drink until you are safe",
    lead,
    bullets: [
      "Use fast-acting carbohydrate as your team taught you — not more alcohol.",
      "Recheck as they recommend until you are clearly back in range and able to think clearly.",
      "Only consider alcohol once you and (if possible) someone with you agree you are safe to continue.",
    ],
    links: { hypoHelp: true, sickDay: false, helpNow: true },
  };
}

const ESTIMATE_DISCLAIMER =
  "This uses the same carb math as Meal Adviser from your settings. Alcohol changes risk overnight — always confirm doses with your care team. Not medical advice.";

export function buildAlcoholSituationOutcome(
  input: AlcoholSituationInput,
  settings: UserSettings,
  profileBgUnits: string | undefined,
): AlcoholSituationOutcome {
  const bgUnits = normalizeBgUnits(profileBgUnits);

  if (input.situation === "feels_wrong" && redFlagActive(input.redFlags)) {
    return URGENT;
  }

  if (hypoGateActive(input.bgSkipped, input.bgValue, input.bgTrend, input.drinkingIntensity, bgUnits)) {
    return hypoOutcome(input.bgValue, bgUnits);
  }

  if (input.situation === "feels_wrong") {
    return {
      kind: "feels_ok",
      headline: "No red flags selected",
      body: "If you still feel seriously unwell, confused, or unable to keep fluids down, use Help now or your emergency plan. Otherwise choose another situation above for meal or planning help.",
      links: { hypoHelp: true, sickDay: true, helpNow: true },
    };
  }

  if (input.situation === "before_out") {
    return {
      kind: "prep_only",
      headline: "Before you go out",
      tips: [
        "Alcohol can cause delayed lows for many hours after you stop drinking — plan checks or alarms with your team.",
        "Never treat a low with more alcohol.",
        "Brief someone you’re with that you have type 1 and where hypo treatment is.",
      ],
      checklist: [
        "Fast-acting carbs are with me (not only in another room)",
        "Phone or CGM alerts are on if I use them",
        "I know how to reach my team or out-of-hours if I worsen",
      ],
    };
  }

  if (input.situation === "meal_with_drinks" || input.situation === "late_snack") {
    const carbs = input.carbsG;
    if (carbs == null || carbs <= 0) {
      return { kind: "needs_carbs", message: "Enter total carbs (grams) for this food or snack to get an estimate." };
    }

    const increment = insulinRoundIncrement(!!input.isPump);
    const meal = calculateMealDose(carbs, input.mealType, settings, bgUnits, undefined, undefined, undefined, increment);
    if (meal.error === "no_ratios") {
      return {
        kind: "needs_ratios",
        message:
          "Add carb ratios (or TDD for a rough estimate) in Settings, or use Ratio Adviser — the same as Meal Adviser needs.",
      };
    }

    const alcoholGuidance = buildAlcoholDoseGuidance({
      standardDose: meal.dose,
      exactDose: meal.exactDose,
      drinkingIntensity: input.drinkingIntensity,
      carbsG: carbs,
      mealType: input.mealType,
      situation: input.situation,
      bgSkipped: input.bgSkipped,
      bgValue: input.bgValue,
      bgTrend: input.bgTrend,
      bgUnits,
      roundIncrement: increment,
    });

    return {
      kind: "estimate",
      meal,
      alcoholGuidance,
      tips: [],
      disclaimer: ESTIMATE_DISCLAIMER,
    };
  }

  return {
    kind: "prep_only",
    headline: "Planning",
    tips: ["Choose a situation above to continue."],
    checklist: [],
  };
}

export function adviserLinkFromAlcohol(carbsG: number, mealType: string): string {
  const safeMeal =
    mealType === "breakfast" || mealType === "lunch" || mealType === "dinner" || mealType === "snack"
      ? mealType
      : "lunch";
  return `/adviser?tab=meal&from=alcohol&carbs=${encodeURIComponent(String(Math.round(carbsG)))}&mealTime=${encodeURIComponent(safeMeal)}`;
}
