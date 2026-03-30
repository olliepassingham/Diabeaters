/**
 * Educational planning outputs for the Alcohol night tool.
 * Does not compute insulin or alcohol amounts — only structured guidance.
 */

export type AlcoholTiming = "tonight" | "planning";
export type AlcoholFood = "with_meal" | "snacks_only" | "unsure";
export type AlcoholActivity = "light" | "moderate" | "heavy";
export type AlcoholCompanions = "alone" | "with_others" | "someone_trained";
export type AlcoholCgm = "yes" | "no" | "unsure";
export type AlcoholInsulin = "pump" | "mdi" | "unsure";
export type AlcoholTrend = "rising" | "flat" | "falling" | "unknown";
export type AlcoholIntensity = "light" | "moderate" | "long_or_heavy";

export type AlcoholRedFlags = {
  vomiting: boolean;
  severeAbdominalPain: boolean;
  confusion: boolean;
  veryHighBgOrKetones: boolean;
  cantKeepFluids: boolean;
};

export type AlcoholNightInputs = {
  timing: AlcoholTiming;
  food: AlcoholFood;
  activityToday: AlcoholActivity;
  companions: AlcoholCompanions;
  cgm: AlcoholCgm;
  insulin: AlcoholInsulin;
  bgSkipped: boolean;
  bgValue: number | null;
  bgTrend: AlcoholTrend | null;
  intensity: AlcoholIntensity;
  redFlags: AlcoholRedFlags;
};

export type AlcoholNightUrgency = "plan" | "caution" | "urgent";

export type AlcoholChecklistItem = { id: string; label: string };

export type AlcoholNightPlan = {
  urgency: AlcoholNightUrgency;
  headline: string;
  lead: string;
  bullets: string[];
  checklist: AlcoholChecklistItem[];
  overnightBullets: string[];
  links: {
    hypoHelp: boolean;
    sickDay: boolean;
    helpNow: boolean;
  };
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

export function normalizeBgUnits(raw: string | undefined): "mmol/L" | "mg/dL" {
  const u = (raw || "mmol/L").toLowerCase();
  if (u.includes("mg")) return "mg/dL";
  return "mmol/L";
}

export function isBgLow(bg: number, units: "mmol/L" | "mg/dL"): boolean {
  return units === "mg/dL" ? bg < 72 : bg < 4;
}

export function isBgVeryHigh(bg: number, units: "mmol/L" | "mg/dL"): boolean {
  return units === "mg/dL" ? bg > 252 : bg > 14;
}

export function buildAlcoholNightPlan(
  input: AlcoholNightInputs,
  bgUnits: "mmol/L" | "mg/dL",
): AlcoholNightPlan {
  const flags = input.redFlags;
  if (redFlagActive(flags)) {
    return {
      urgency: "urgent",
      headline: "Get medical help or contact your team now",
      lead: "You indicated symptoms or signs that can be serious with type 1 diabetes. Do not rely on this app — use your emergency plan.",
      bullets: [
        "If you are vomiting repeatedly, cannot keep fluids down, or feel confused, seek urgent care or call your local emergency number if advised.",
        "High glucose with ketones, or severe abdominal pain, needs urgent assessment — not wait until tomorrow.",
        "If in doubt, it is safer to be checked than to stay home.",
      ],
      checklist: [
        { id: "urgent-1", label: "I have told someone nearby how I feel" },
        { id: "urgent-2", label: "I am following my clinic's sick-day or emergency instructions" },
        { id: "urgent-3", label: "I will not drink alcohol until a clinician has cleared me" },
      ],
      overnightBullets: [],
      links: { hypoHelp: true, sickDay: true, helpNow: true },
    };
  }

  const bg = !input.bgSkipped && input.bgValue != null ? input.bgValue : null;
  const trend = input.bgTrend || "unknown";
  let hypoGate = false;
  if (bg != null) {
    if (isBgLow(bg, bgUnits)) hypoGate = true;
    if (!isBgLow(bg, bgUnits) && trend === "falling" && input.intensity !== "light") {
      hypoGate = true;
    }
  }

  if (hypoGate) {
    const uLabel = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
    return {
      urgency: "caution",
      headline: "Treat glucose first — do not drink until you are safe",
      lead:
        bg != null && isBgLow(bg, bgUnits)
          ? `Your entered BG (${bg} ${uLabel}) is in a range where drinking is unsafe until you have treated and recovered per your team's hypo plan.`
          : "A falling glucose pattern plus alcohol can lead to lows later. Confirm you are in a safe range and feeling well before drinking.",
      bullets: [
        "Use fast-acting carbohydrate as your team taught you — not more alcohol.",
        "Recheck as they recommend until you are clearly back in range and able to think clearly.",
        "Only consider alcohol once you and (if possible) someone with you agree you are safe to continue.",
      ],
      checklist: [
        { id: "hypo-1", label: "I have fast-acting glucose within reach" },
        { id: "hypo-2", label: "I have treated any low per my usual plan" },
        { id: "hypo-3", label: "I feel back to my normal self before considering alcohol" },
      ],
      overnightBullets: [
        "After drinking, alcohol can still cause delayed lows overnight — keep this in mind once you are safe to drink in future.",
      ],
      links: { hypoHelp: true, sickDay: false, helpNow: true },
    };
  }

  const bullets: string[] = [];
  const checklist: AlcoholChecklistItem[] = [];
  const overnight: string[] = [];

  bullets.push("This tool does not tell you how much to drink or how to change insulin — only your care team should do that.");

  if (input.timing === "planning") {
    bullets.push("Planning ahead makes overnight lows less likely: agree when you will check glucose and where hypo treatment will be.");
  } else {
    bullets.push("If you are going out soon, pause until you have fast carbs, know your current glucose, and someone knows you have type 1.");
  }

  if (input.food === "with_meal") {
    bullets.push("Having alcohol with food (when your team agrees) is often safer than drinking on an empty stomach.");
  } else if (input.food === "snacks_only") {
    bullets.push("Small snacks may not cover the same risk as a full meal — be cautious with insulin and alcohol together.");
  } else {
    bullets.push("If you are unsure about food, consider checking glucose more often and keeping extra fast carbs with you.");
  }

  if (input.activityToday === "heavy") {
    bullets.push("A demanding activity day can increase hypo risk later, especially with alcohol — extra checks overnight may be appropriate (ask your team).");
  } else if (input.activityToday === "moderate") {
    bullets.push("Activity earlier today can still affect glucose into the evening; stay aware of trends if you use CGM.");
  }

  if (input.companions === "alone") {
    bullets.push("If you live or sleep alone, delayed overnight hypos are higher stakes — discuss alarm strategies and whether an overnight snack plan applies to you.");
    overnight.push("Set any CGM or phone alerts you use, and place hypo treatment on your bedside before sleep.");
  } else if (input.companions === "someone_trained") {
    bullets.push("Brief the person with you on how to use glucagon or call for help if you become confused.");
  } else {
    bullets.push("Tell someone you are with that you have type 1 and where your glucose tablets or juice are.");
  }

  if (input.cgm === "yes") {
    bullets.push("Use trend arrows as well as the number — a gentle fall toward bedtime can become a low after alcohol.");
  } else if (input.cgm === "no") {
    bullets.push("Without CGM, fingerstick checks before bed and overnight may be especially important on drinking nights — follow your team's advice.");
  }

  if (input.insulin === "pump") {
    bullets.push("Pump users should keep pen backup in mind for equipment issues; alcohol does not remove that need.");
  }

  if (input.intensity === "light") {
    overnight.push("Even a small amount of alcohol can contribute to delayed lows — one extra awareness check may still be reasonable.");
  } else if (input.intensity === "moderate") {
    overnight.push("Moderate social drinking often increases delayed hypo risk for several hours — plan sleep with that in mind.");
  } else {
    overnight.push("Longer or heavier drinking stretches the window for delayed lows; this is a night to prioritise checks and your team's overnight plan.");
  }

  if (bg != null && isBgVeryHigh(bg, bgUnits)) {
    bullets.push("Very high glucose needs a clear plan from your team before drinking; if ketones might be present, use your sick-day guidance.");
  }

  checklist.push(
    { id: "c1", label: "Fast-acting carbs are with me (not only in another room or car boot)" },
    { id: "c2", label: "I will not treat a hypo with more alcohol" },
    { id: "c3", label: "Someone knows I have type 1 and basic hypo steps" },
    { id: "c4", label: "I know how to reach my diabetes team or out-of-hours service if I worsen" },
  );

  if (input.companions === "alone") {
    checklist.push({ id: "c5", label: "I have a plan to wake for lows or someone to check on me" });
  }

  const headline =
    input.intensity === "long_or_heavy" || input.companions === "alone"
      ? "Higher overnight risk — use extra care"
      : input.timing === "planning"
        ? "Your evening plan"
        : "Before you drink";

  return {
    urgency: "plan",
    headline,
    lead: "Below is a personalised checklist and reminders based on what you entered. Confirm anything uncertain with your clinic.",
    bullets,
    checklist,
    overnightBullets: overnight,
    links: { hypoHelp: true, sickDay: true, helpNow: false },
  };
}
