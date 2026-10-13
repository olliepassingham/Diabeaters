/**
 * Short in-app guides Beatie may quote. Excerpts are educational only:
 * no doses, ratios, targets, or device changes. Every href is on the allow-list.
 */

import { ALLOWED_HREFS, type AllowedHref } from "./types.ts";

export interface MatchedAppGuide {
  href: AllowedHref;
  label: string;
  excerpt: string;
}

type GuideEntry = MatchedAppGuide & { keywords: string[] };

const GUIDES: GuideEntry[] = [
  {
    href: "/scenarios/exercise",
    label: "Exercise guide",
    excerpt:
      "The exercise guide covers planning around activity: checking glucose before you start, having fast carbohydrate with you, and noticing how different activities affect you afterwards. It does not set a dose or a target.",
    keywords: ["exercise", "workout", "running", "swimming", "football", "sport", "before exercise"],
  },
  {
    href: "/scenarios/sick-day",
    label: "Sick day guide",
    excerpt:
      "The sick day guide covers what to watch when you are unwell: fluids, carbohydrate you can manage, and when to use Help Now or contact your team. It does not change an insulin plan.",
    keywords: ["sick day", "unwell", "illness", "vomiting", "flu"],
  },
  {
    href: "/scenarios/travel",
    label: "Travel guide",
    excerpt:
      "The travel guide covers time zones, supplies to pack, and how meals and activity can change away from home. Open it for the checklist in the app.",
    keywords: ["travel", "flying", "airport", "holiday", "time zone"],
  },
  {
    href: "/scenarios/bedtime",
    label: "Bedtime guide",
    excerpt:
      "The bedtime guide covers an evening check: glucose before sleep, a snack if that is already part of your plan, and what to do if you feel low. It does not set a night-time dose.",
    keywords: ["bedtime", "before bed", "overnight", "night time"],
  },
  {
    href: "/scenarios/alcohol",
    label: "Alcohol guide",
    excerpt:
      "The alcohol guide is for adults. It covers how alcoholic drinks can affect glucose later, especially overnight, and why it helps to eat and to tell someone you are with. It does not set a drink limit or a dose.",
    keywords: ["alcohol", "drinking", "beer", "wine"],
  },
  {
    href: "/scenarios/driving",
    label: "Driving guide",
    excerpt:
      "The driving guide covers checking glucose before you drive and what to do if you feel low. It does not set a legal limit or a dose. Follow the rules you have already been given for driving.",
    keywords: ["driving", "drive", "driver"],
  },
  {
    href: "/scenarios/pump-failure",
    label: "Pump failure guide",
    excerpt:
      "The pump failure guide covers practical steps if insulin delivery from a pump stops: check the site and supplies, and use the backup plan from your team. Beatie does not tell you a replacement dose.",
    keywords: ["pump failure", "pump stopped", "site failure", "occlusion"],
  },
  {
    href: "/tools/hypo-help",
    label: "Hypo Help",
    excerpt:
      "Hypo Help is the in-app guide for a low: fast-acting carbohydrate you already use, a recheck, and longer-acting food if that is part of your plan. If symptoms are severe or you cannot treat it yourself, use Help Now.",
    keywords: ["hypo", "hypos", "hypoglycaemia", "hypoglycemia", "low blood"],
  },
  {
    href: "/tools/patterns",
    label: "Patterns",
    excerpt:
      "Patterns shows glucose readings stored on this phone, including time in, below, and above range once there are enough sensor readings. It does not diagnose or estimate an HbA1c.",
    keywords: ["pattern", "time in range", "trends"],
  },
  {
    href: "/adviser?tab=meal&split=1",
    label: "Split bolus",
    excerpt:
      "Split bolus is a Meal Adviser option for meals that digest slowly, such as higher fat or protein meals. It explains the idea. It does not calculate how to split a dose.",
    keywords: ["split bolus", "split dose", "dual wave"],
  },
  {
    href: "/adviser?tab=meal",
    label: "Meal Adviser",
    excerpt:
      "Meal Adviser helps you build a meal from foods and see a carbohydrate estimate with a range. The number is an estimate from typical portions, not a dose.",
    keywords: ["meal adviser", "meal advisor", "carbohydrate", "carbs", "food list"],
  },
  {
    href: "/routines",
    label: "Routines",
    excerpt:
      "Routines is where you save meals and other repeating plans, including a carbohydrate estimate for a meal. Open it to create, edit, or follow a routine.",
    keywords: ["routine", "saved meal", "meal plan"],
  },
  {
    href: "/tools/correction",
    label: "Correction",
    excerpt:
      "The correction screen is for recording a correction you have already chosen from your own plan. Beatie does not calculate a correction dose, ratio, or target.",
    keywords: ["correction"],
  },
  {
    href: "/supplies",
    label: "Supplies",
    excerpt:
      "Supplies is the list of insulin, sensors, and other items you track, with reminders when stock is low.",
    keywords: ["supplies", "stock", "prescription"],
  },
  {
    href: "/help-now",
    label: "Help Now",
    excerpt:
      "Help Now is the urgent handoff in the app: what to do in an emergency and how to reach help. Use it when symptoms feel severe or unfamiliar.",
    keywords: ["help now", "emergency", "urgent"],
  },
  {
    href: "/education",
    label: "Education",
    excerpt:
      "Education is the in-app glossary and short articles. Open a topic there for the wording the app already uses.",
    keywords: ["glossary", "education", "what does"],
  },
  {
    href: "/settings/cgm",
    label: "CGM settings",
    excerpt:
      "CGM settings is where you connect a sensor source so readings can show in the app. Connecting does not change doses.",
    keywords: ["cgm", "dexcom", "libre", "sensor"],
  },
  {
    href: "/tools/activity",
    label: "Activity",
    excerpt:
      "Activity is where you log exercise you have done and how glucose responded, so later questions have something in the app to refer to.",
    keywords: ["activity log", "log exercise", "exercise log"],
  },
];

function wordsOf(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function keywordHits(text: string, words: string[], keyword: string): boolean {
  const parts = keyword.toLowerCase().split(" ").filter(Boolean);
  if (!parts.length) return false;
  if (parts.length > 1) return text.includes(parts.join(" "));
  const token = parts[0]!;
  return words.some((word) => word === token || (token.length >= 5 && word.startsWith(token)));
}

/** Best matching guide for a user message, or null when nothing in the app is a clear fit. */
export function matchAppGuide(message: string): MatchedAppGuide | null {
  const text = message.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 3) return null;
  const words = wordsOf(message);
  let best: GuideEntry | null = null;
  let bestScore = 0;
  let bestKeyword = 0;
  for (const guide of GUIDES) {
    if (!ALLOWED_HREFS.includes(guide.href)) continue;
    let score = 0;
    let longest = 0;
    for (const keyword of guide.keywords) {
      if (!keywordHits(text, words, keyword)) continue;
      score += keyword.length;
      longest = Math.max(longest, keyword.length);
    }
    if (score < 4) continue;
    if (score > bestScore || (score === bestScore && longest > bestKeyword)) {
      best = guide;
      bestScore = score;
      bestKeyword = longest;
    }
  }
  if (!best) return null;
  return { href: best.href, label: best.label, excerpt: best.excerpt };
}
