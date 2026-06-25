import { filterPumpTipsForClosedLoop, usesClosedLoop } from "@/lib/closed-loop";
import type { UserSettings } from "@/lib/storage";

export type ClosedLoopExercisePhase = "pre" | "during" | "post" | "recovery";

export function exerciseChecklistBasalLabel(usesLoop: boolean, fallback = "Reduced basal rate"): string {
  return usesLoop ? "Reviewed loop / exercise plan on pump" : fallback;
}

/**
 * Pump coaching for hybrid/full closed loop — avoids manual temp-basal instructions.
 * Educational only; users confirm with their care team and device.
 */
export function closedLoopPumpTipsForIntensity(
  intensity: "light" | "moderate" | "intense",
): ExercisePlanResult["pumpTips"] {
  if (intensity === "light") {
    return {
      pre: [
        "Check BG and trend — many loops reduce insulin when activity is detected.",
        "If you use an exercise or temp target on your pump, set it before you start (per your team).",
      ],
      during: ["Let the loop respond to drops; keep fast carbs within reach."],
      post: ["Glucose may fall for 1–2 hours after — your loop may still be reducing insulin."],
      recovery: [
        "Monitor for delayed lows into the evening; avoid stacking manual corrections on top of loop adjustments.",
      ],
    };
  }
  if (intensity === "moderate") {
    return {
      pre: [
        "Check IOB from your last meal bolus — active insulin before cardio is a common cause of early hypos.",
        "Consider a small pre-exercise snack if IOB is high or BG is trending down (confirm with your team).",
        "If your pump has Exercise or temp target mode, switch it on before the session.",
      ],
      during: [
        "Hypos often appear 30–60 min in — check BG even if the loop looks steady.",
        "Treat lows with fast carbs; let the loop handle basal unless your team advises a manual change.",
      ],
      post: [
        "Delayed dips are common 1–3 hours after — keep snacking and monitoring.",
        "If BG rises after sport, wait before a manual correction — the loop may still be catching up.",
      ],
      recovery: [
        "Evening sessions: watch overnight — many people see lows 4–8 hours later on closed loop.",
        "Open the Bedtime tool if training was late afternoon or evening.",
      ],
    };
  }
  return {
    pre: [
      "High IOB + intense work is high risk — consider timing meals and boluses earlier (your team's plan).",
      "Start with BG in a safe range and a stable or rising trend; set exercise / temp target if you use one.",
    ],
    during: [
      "Rapid drops can outpace loop adjustments — check every 20–30 min for intense sessions.",
      "Disconnecting for swimming? Plan with your team — don't assume the loop has compensated.",
    ],
    post: ["Post-exercise lows can last many hours — keep recovery fuel available."],
    recovery: [
      "Intense training can increase hypo risk for up to 24h — prioritize monitoring over manual basal tweaks.",
      "If similar sessions caused hypos before, plan extra checks tonight.",
    ],
  };
}

export function resolveExercisePumpTips(
  baseTips: ExercisePlanResult["pumpTips"],
  intensity: "light" | "moderate" | "intense",
  settings: UserSettings | null | undefined,
): ExercisePlanResult["pumpTips"] {
  if (!usesClosedLoop(settings)) return baseTips;
  return closedLoopPumpTipsForIntensity(intensity);
}

export function closedLoopPrePumpLeadIn(minutesUntilStart: number, intensity: "light" | "moderate" | "intense"): string | null {
  if (intensity === "light" || minutesUntilStart < 90) return null;
  return `With ~${minutesUntilStart} min until start, review IOB and your loop's exercise settings before you begin.`;
}

export function pumpTipsForPhase(
  pumpTips: ExercisePlanResult["pumpTips"],
  phase: ClosedLoopExercisePhase,
): string[] {
  switch (phase) {
    case "pre":
      return pumpTips.pre;
    case "during":
      return pumpTips.during;
    case "post":
      return pumpTips.post;
    case "recovery":
      return pumpTips.recovery;
  }
}

export function closedLoopExercisePrePrompt(usesLoop: boolean): string | null {
  if (!usesLoop) return null;
  return "Before you start: check IOB, trend, and whether your pump's exercise or temp target is set.";
}

/** Tips ready to show in UI — closed-loop tips are already tailored; open-loop tips get filtered. */
export function displayPumpTipsForExercise(
  tips: string[],
  settings: UserSettings | null | undefined,
): string[] {
  if (tips.length === 0) return [];
  if (usesClosedLoop(settings)) return tips.slice(0, 4);
  return filterPumpTipsForClosedLoop(tips, settings);
}

export function pumpTipsCardTitle(settings: UserSettings | null | undefined): string {
  return usesClosedLoop(settings) ? "Closed loop" : "Pump users";
}
