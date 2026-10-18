import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { isType2AppSession } from "@/lib/insulin-clinical-access";
import type { UserProfile } from "@/lib/storage";

export interface Tip {
  text: string;
  category: "supplies" | "food" | "exercise" | "daily" | "mental";
  tags?: string[];
  /**
   * Shown only for that audience.
   * - pen / pump: Type 1 insulin delivery
   * - type2: Type 2 patient mode (no insulin dosing tips)
   * Shared tips omit this.
   */
  audience?: "pen" | "pump" | "type2";
}

export const TIPS: Tip[] = [
  { text: "Rotate your injection sites regularly — using the same spot can cause hard lumps under the skin that affect insulin absorption.", category: "supplies", tags: ["injection"], audience: "pen" },
  { text: "Rotate infusion sites — using the same spot can cause hard lumps that affect how insulin is absorbed.", category: "supplies", tags: ["pump"], audience: "pump" },
  { text: "Store opened insulin at room temperature — cold insulin from the fridge can sting more when injecting.", category: "supplies", audience: "pen" },
  { text: "Store opened insulin at room temperature — insulin that is very cold can be less comfortable to wear.", category: "supplies", audience: "pump" },
  { text: "Keep a spare set of supplies in your bag, car, or at work — you never know when you might need them.", category: "supplies" },
  { text: "Check your CGM sensor adhesion daily — a loose sensor gives unreliable readings.", category: "supplies", tags: ["cgm"] },
  { text: "Set a reminder to reorder supplies a week before they run out — don't leave it until the last minute.", category: "supplies" },
  { text: "Always check your insulin hasn't expired — expired insulin can be much less effective.", category: "supplies", audience: "pen" },
  { text: "Always check your insulin hasn't expired — expired insulin can be much less effective.", category: "supplies", audience: "pump" },
  { text: "Keep insulin away from direct sunlight and extreme heat — it can lose potency quickly.", category: "supplies", audience: "pen" },
  { text: "Keep insulin away from direct sunlight and extreme heat — it can lose potency quickly.", category: "supplies", audience: "pump" },
  { text: "Carry a backup pen or syringe even if you use a pump — technology can fail at the worst times.", category: "supplies", tags: ["pump"], audience: "pump" },

  // Type 2 supply / meds
  { text: "Rename starter supplies to match your real medicines and kit — then set a daily usage so runway estimates stay useful.", category: "supplies", audience: "type2" },
  { text: "Keep test strips and lancets dry and in date — humidity and heat can spoil strips.", category: "supplies", audience: "type2" },
  { text: "If you use a CGM or flash sensor, check adhesion daily — a loose sensor gives unreliable readings.", category: "supplies", tags: ["cgm"], audience: "type2" },
  { text: "Set a reminder to reorder tablets, strips, or sensors a week before they run out.", category: "supplies", audience: "type2" },
  { text: "Keep a small spare kit (strips, lancets, or sensors) in your bag or at work.", category: "supplies", audience: "type2" },

  { text: "Weigh your food when you can — eyeballing portions often leads to underestimating carbs.", category: "food", audience: "pen" },
  { text: "Weigh your food when you can — eyeballing portions often leads to underestimating carbs.", category: "food", audience: "pump" },
  { text: "High-fat meals like pizza can cause a delayed blood sugar rise — consider splitting your dose.", category: "food", audience: "pen" },
  { text: "High-fat meals like pizza can cause a delayed blood sugar rise — consider splitting your dose.", category: "food", audience: "pump" },
  { text: "Protein in large amounts can also raise blood sugar, just more slowly than carbs.", category: "food" },
  { text: "Keep a list of your most common meals and their carb counts — it saves time and improves accuracy.", category: "food", audience: "pen" },
  { text: "Keep a list of your most common meals and their carb counts — it saves time and improves accuracy.", category: "food", audience: "pump" },
  { text: "Fibre doesn't raise blood sugar — in some countries you subtract it from total carbs to get 'net carbs'.", category: "food" },
  { text: "Liquid carbs like juice and regular fizzy drinks hit your bloodstream very fast — useful for hypos, tricky for meals.", category: "food" },
  { text: "If you're unsure about the carbs in a meal, it's usually safer to slightly underestimate your dose and correct later.", category: "food", audience: "pen" },
  { text: "If you're unsure about the carbs in a meal, it's usually safer to slightly underestimate your dose and correct later.", category: "food", audience: "pump" },
  { text: "Eating at consistent times can make blood sugar patterns easier to spot and manage.", category: "food" },
  { text: "Building meals around vegetables, protein, and fibre often helps steady post-meal glucose — follow what your team recommends.", category: "food", audience: "type2" },
  { text: "Sweet drinks raise glucose quickly — useful if you are low, but easy to overlook at meals.", category: "food", audience: "type2" },
  { text: "If you count carbs for education, keep a short list of your usual meals — it helps pattern spotting, not dosing in this mode.", category: "food", audience: "type2" },

  { text: "Check your blood sugar before exercise — starting below 7 mmol/L may mean you need a snack first.", category: "exercise", audience: "pen" },
  { text: "Check your blood sugar before exercise — starting below 7 mmol/L may mean you need a snack first.", category: "exercise", audience: "pump" },
  { text: "Resistance training can sometimes raise blood sugar temporarily — don't panic, it usually settles.", category: "exercise" },
  { text: "Keep fast-acting glucose within arm's reach during any workout.", category: "exercise" },
  { text: "A short walk after meals can help reduce post-meal blood sugar spikes.", category: "exercise" },
  { text: "Exercise can increase insulin sensitivity for up to 24 hours — watch for delayed hypos, especially overnight.", category: "exercise", audience: "pen" },
  { text: "Exercise can increase insulin sensitivity for up to 24 hours — watch for delayed hypos, especially overnight.", category: "exercise", audience: "pump" },
  { text: "Swimming and water sports can mask hypo symptoms — check more frequently around water.", category: "exercise" },
  { text: "Morning exercise tends to raise blood sugar less than afternoon sessions for many people — experiment to find your pattern.", category: "exercise" },
  { text: "A short walk after meals is one of the simplest ways many people with Type 2 steady post-meal rises.", category: "exercise", audience: "type2" },
  { text: "If you take medicines that can lower glucose, ask your team whether you need snacks or checks around workouts.", category: "exercise", audience: "type2" },

  { text: "Stress and illness can raise blood sugar even without eating — monitor more frequently on tough days.", category: "daily" },
  { text: "Alcohol can cause delayed hypos — check your blood sugar before bed after drinking.", category: "daily" },
  { text: "Heat can speed up insulin absorption — be mindful on hot days or after hot baths.", category: "daily", audience: "pen" },
  { text: "Heat can speed up insulin absorption — be mindful on hot days or after hot baths.", category: "daily", audience: "pump" },
  { text: "Always carry medical ID — it speaks for you if you can't.", category: "daily" },
  { text: "Tell someone you trust how to use glucagon — it could save your life.", category: "daily", audience: "pen" },
  { text: "Tell someone you trust how to use glucagon — it could save your life.", category: "daily", audience: "pump" },
  { text: "Flying across time zones? Adjust your long-acting insulin timing gradually — ask your diabetes team for a plan.", category: "daily", tags: ["travel"], audience: "pen" },
  { text: "Flying across time zones? Move the pump clock toward local time gradually — ask your diabetes team for a plan.", category: "daily", tags: ["travel", "pump"], audience: "pump" },
  { text: "Keep glucose tablets or sweets in every coat pocket and bag — hypos don't wait for convenience.", category: "daily" },
  { text: "If you're unwell, never stop taking your basal insulin — even if you're not eating. Contact your team if unsure.", category: "daily", audience: "pen" },
  { text: "If you're unwell, never stop taking your basal insulin — even if you're not eating. Contact your team if unsure.", category: "daily", audience: "pump" },
  { text: "Hormones, sleep, and even the weather can affect blood sugar — some days there's no obvious reason for a high or low.", category: "daily" },
  { text: "When driving, always check your blood sugar before setting off and keep hypo treatment in the car.", category: "daily" },
  { text: "Keep Help Now details up to date so bystanders know you have Type 2 diabetes.", category: "daily", audience: "type2" },
  { text: "Book eye, foot, and blood-test reviews when invited — screening catches problems early.", category: "daily", audience: "type2" },
  { text: "If you drink alcohol, check glucose before bed — some Type 2 medicines can increase hypo risk.", category: "daily", audience: "type2" },
  { text: "Take medicines as prescribed — if doses feel wrong or side effects appear, contact your clinic rather than stopping suddenly.", category: "daily", audience: "type2" },

  { text: "Diabetes burnout is real — it's okay to have days where you do the minimum. Just don't stop completely.", category: "mental" },
  { text: "You don't need perfect numbers to be doing a good job — aim for progress, not perfection.", category: "mental" },
  { text: "Talking to others with diabetes can help — you're not the only one dealing with this.", category: "mental" },
  { text: "It's okay to feel frustrated by diabetes — acknowledging it is the first step to managing it.", category: "mental" },
  { text: "Celebrate the small wins — a good day in range, remembering supplies, or trying a new meal. They all count.", category: "mental" },
  { text: "Ask for help when you need it — from your diabetes team, family, or others living with diabetes. Nobody manages this alone.", category: "mental" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  supplies: "Supplies",
  food: "Food & carbs",
  exercise: "Exercise",
  daily: "Daily life",
  mental: "Wellbeing",
};

/** @deprecated Prefer tipsForProfile — pen/pump only, treats everyone else as pen. */
export function tipsForDelivery(method: string | null | undefined): Tip[] {
  const pump = isPumpDeliveryMethod(method);
  return TIPS.filter((tip) => {
    if (!tip.audience) return true;
    if (tip.audience === "type2") return false;
    return pump ? tip.audience === "pump" : tip.audience === "pen";
  });
}

export function tipsForProfile(profile: UserProfile | null | undefined): Tip[] {
  if (isType2AppSession(profile)) {
    return TIPS.filter((tip) => !tip.audience || tip.audience === "type2");
  }
  return tipsForDelivery(profile?.insulinDeliveryMethod);
}

export function getTipIndex(date: Date, tipCount = TIPS.length): number {
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const count = Math.max(1, tipCount);
  return daysSinceEpoch % count;
}
