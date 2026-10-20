/**
 * Deterministic in-app navigation for Beatie.
 *
 * When a message is clearly a "where do I find…?" question about the app
 * itself, the Edge Function answers from this directory instead of asking
 * the LLM to guess a route. Every reply names the on-screen path in words
 * (for example "Tools → Hypo history") and carries a matching
 * `suggestedNextActions` button, so the user can read the route or tap
 * straight there.
 *
 * Safety: messages that read as an acute self-report (feeling low, having
 * a hypo, vomiting, ketones high, asking for an ambulance, safeguarding
 * terms) return null here so the hard interceptor in `interceptor.ts`
 * still handles them first-class. Alcohol and driving destinations keep
 * the same age gates as the post-filter: under-age or unknown age never
 * receives those hrefs.
 *
 * Pure logic — runs under both Deno and Vitest.
 */

import { ALLOWED_HREFS, type AllowedHref, type CoachAction, type CoachReply } from "./types.ts";

export interface AppNavigationDestination {
  href: AllowedHref;
  /** Screen name shown to the user, e.g. "Hypo history". */
  title: string;
  /** On-screen route in words, e.g. "Tools → Hypo history". */
  path: string;
  /** One plain sentence on what the screen holds. */
  blurb: string;
  keywords: string[];
  /** Minimum whole years of age before this href may be offered. */
  minAge?: number;
}

export const APP_NAVIGATION_DESTINATIONS: AppNavigationDestination[] = [
  {
    href: "/",
    title: "Home",
    path: "Home (bottom tab)",
    blurb: "Home shows today's glucose, supply runway, and your next steps.",
    keywords: ["home screen", "home tab", "home page", "dashboard", "widgets", "edit home", "home widgets"],
  },
  {
    href: "/tools",
    title: "Tools",
    path: "Tools (bottom tab)",
    blurb: "Tools holds the calculators, logs, and trackers in one list.",
    keywords: ["tools list", "all the tools", "all tools", "tools hub"],
  },
  {
    href: "/scenarios",
    title: "Guides",
    path: "Guides (bottom tab)",
    blurb: "Guides holds step-by-step help for specific moments like exercise, bedtime, and travel.",
    keywords: ["guides list", "situation guides", "all the guides", "all guides", "scenarios"],
  },
  {
    href: "/community",
    title: "Community feed",
    path: "Feed (bottom tab)",
    blurb: "The feed is where community posts and stories appear.",
    keywords: ["community feed", "the feed", "community posts", "people's posts"],
  },
  {
    href: "/community/setup",
    title: "Community profile setup",
    path: "Feed → Set up profile",
    blurb: "This is where you set your display name and @handle before posting.",
    keywords: ["handle", "display name", "username", "user name", "community profile", "set up profile", "start posting"],
  },
  {
    href: "/community/messages",
    title: "Messages",
    path: "Feed → Messages",
    blurb: "Messages holds your private chats with people in the community.",
    keywords: ["messages", "inbox", "direct message", "private chats", "message someone"],
  },
  {
    href: "/account",
    title: "Account",
    path: "Account (bottom tab)",
    blurb: "Account holds your profile, app mode, and the way into Settings.",
    keywords: ["my account", "account page", "sign out", "log out", "delete account", "account settings"],
  },
  {
    href: "/appointments",
    title: "Appointments",
    path: "Tools → Appointments",
    blurb: "Appointments holds clinic visits and check-ups, with reminders.",
    keywords: ["appointment", "appointments", "clinic visit", "check-up", "check up", "consultant"],
  },
  {
    href: "/adviser?tab=meal",
    title: "Meal & ratios",
    path: "Tools → Meal & ratios",
    blurb: "Meal & ratios builds a meal and works out meal insulin from your saved carb ratios.",
    keywords: ["meal adviser", "meal advisor", "meal calculator", "bolus calculator", "carb calculator", "meal insulin", "work out carbs"],
  },
  {
    href: "/adviser?tab=meal&split=1",
    title: "Split bolus",
    path: "Tools → Meal & ratios → Split bolus",
    blurb: "Split bolus is the Meal Adviser option for meals that digest slowly.",
    keywords: ["split bolus", "split a bolus", "split dose", "extended bolus", "dual wave"],
  },
  {
    href: "/scenarios/exercise",
    title: "Exercise guide",
    path: "Guides → Exercise",
    blurb: "The exercise guide helps you plan around activity, with checks before you start.",
    keywords: ["exercise guide", "exercise", "workout guide", "running", "sport guide"],
  },
  {
    href: "/scenarios/bedtime",
    title: "Bedtime guide",
    path: "Guides → Bedtime",
    blurb: "The bedtime guide walks through an evening check before sleep.",
    keywords: ["bedtime", "before bed", "overnight guide", "night-time guide"],
  },
  {
    href: "/scenarios/sick-day",
    title: "Sick day guide",
    path: "Guides → Sick day",
    blurb: "The sick day guide covers what to watch and track while you are unwell.",
    keywords: ["sick day", "sick-day", "unwell guide", "illness guide"],
  },
  {
    href: "/scenarios/travel",
    title: "Travel guide",
    path: "Guides → Travel",
    blurb: "The travel guide has the packing checklist and time-zone help for trips away.",
    keywords: ["travel guide", "travel", "holiday guide", "flying", "trip checklist"],
  },
  {
    href: "/scenarios/alcohol",
    title: "Alcohol guide",
    path: "Guides → Alcohol",
    blurb: "The alcohol guide covers how drinks can affect glucose later, especially overnight.",
    keywords: ["alcohol guide", "alcohol", "drinking guide"],
    minAge: 18,
  },
  {
    href: "/scenarios/driving",
    title: "Driving guide",
    path: "Guides → Driving",
    blurb: "The driving guide is a short readiness check before you drive.",
    keywords: ["driving guide", "driving", "drive check"],
    minAge: 17,
  },
  {
    href: "/scenarios/pump-failure",
    title: "Pump failure guide",
    path: "Guides → Pump failure",
    blurb: "The pump failure guide covers practical steps if pump delivery stops.",
    keywords: ["pump failure", "pump stopped", "infusion set failure", "occlusion"],
  },
  {
    href: "/tools/hypo-help",
    title: "Hypo help",
    path: "Tools → Hypo help",
    blurb: "Hypo help gives fast-carb amounts for a low and what to do next.",
    keywords: ["hypo help", "treat a hypo", "treating a low", "low glucose help", "hypo treatment"],
  },
  {
    href: "/tools/correction",
    title: "Correction helper",
    path: "Tools → Correction helper",
    blurb: "The correction helper works out a correction from your saved sensitivity factor.",
    keywords: ["correction helper", "correction calculator"],
  },
  {
    href: "/tools/tips",
    title: "Tips",
    path: "Tools → Tips",
    blurb: "Tips holds the tip of the day plus more ideas to browse.",
    keywords: ["tips", "tip of the day", "daily tip"],
  },
  {
    href: "/tools/activity",
    title: "Activity log",
    path: "Tools → Activity log",
    blurb: "The activity log is a calendar of everything you have logged.",
    keywords: ["activity log", "log exercise", "exercise log", "workout log", "activity calendar", "log activity"],
  },
  {
    href: "/tools/patterns",
    title: "Your patterns",
    path: "Tools → Your patterns",
    blurb: "Your patterns shows charts of your lows and time in range over time.",
    keywords: ["patterns", "time in range", "glucose charts", "pattern charts", "my graphs", "trends over time"],
  },
  {
    href: "/tools/hypo-history",
    title: "Hypo history",
    path: "Tools → Hypo history",
    blurb: "Hypo history shows monthly counts and what you treated each low with.",
    keywords: ["hypo history", "past hypos", "previous hypos", "hypo log", "log a hypo", "record a hypo", "how many hypos"],
  },
  {
    href: "/tools/glucose-converter",
    title: "Glucose units converter",
    path: "Tools → Glucose units",
    blurb: "The converter switches a glucose value between mmol/L and mg/dL.",
    keywords: ["convert glucose", "glucose converter", "unit converter", "convert units", "mmol to mg"],
  },
  {
    href: "/tools/achievements",
    title: "Achievements",
    path: "Tools → Achievements",
    blurb: "Achievements holds your streak badges, ready to pin to your profile.",
    keywords: ["achievements", "badges", "streaks", "streak"],
  },
  {
    href: "/tools/cgm-live",
    title: "Glucose trends",
    path: "Tools → Glucose trends",
    blurb: "Glucose trends shows the near-live CGM chart from a connected sensor.",
    keywords: ["live glucose", "live cgm", "cgm live", "current glucose", "live chart", "glucose trends", "sensor chart"],
  },
  {
    href: "/education",
    title: "Education",
    path: "Tools → Education",
    blurb: "Education holds plain-language articles and definitions.",
    keywords: ["education", "articles", "glossary", "reading hub"],
  },
  {
    href: "/settings",
    title: "Settings",
    path: "Account → Settings",
    blurb: "Settings holds your personal setup, insulin settings, CGM connection, and notifications.",
    keywords: ["settings", "app settings"],
  },
  {
    href: "/settings/usage",
    title: "Personal & usage",
    path: "Account → Settings → Personal & usage",
    blurb: "Personal & usage holds your date of birth, delivery method, units, and CGM use.",
    keywords: ["date of birth", "dob", "personal details", "delivery method", "pen or pump", "change my units", "units setting", "closed loop", "personal and usage"],
  },
  {
    href: "/settings/ratios",
    title: "Ratios & insulin settings",
    path: "Account → Settings → Ratios",
    blurb: "Ratios is where your carb ratios, sensitivity factor, targets, and insulin settings are saved.",
    keywords: ["ratios", "carb ratio", "carb ratios", "sensitivity factor", "isf", "insulin settings", "basal settings", "my targets", "target settings"],
  },
  {
    href: "/settings/cgm",
    title: "CGM settings",
    path: "Account → Settings → CGM",
    blurb: "CGM settings is where you connect Dexcom or Libre so readings show in the app.",
    keywords: ["connect dexcom", "dexcom", "libre", "connect sensor", "connect cgm", "cgm settings", "sensor connection", "connect my sensor"],
  },
  {
    href: "/settings/notifications",
    title: "Notifications",
    path: "Account → Settings → Notifications",
    blurb: "Notifications is where you choose which alerts and reminders you receive.",
    keywords: ["notifications", "notification settings", "turn off alerts", "push notifications", "alert settings", "reminder settings"],
  },
  {
    href: "/settings/pharmacy",
    title: "Your pharmacy",
    path: "Account → Settings → Your pharmacy",
    blurb: "Your pharmacy holds your pharmacy details and opening hours.",
    keywords: ["pharmacy", "chemist", "pharmacy details"],
  },
  {
    href: "/settings/emergency",
    title: "Emergency contacts",
    path: "Account → Settings → Emergency",
    blurb: "Emergency settings hold the contacts to reach in an emergency.",
    keywords: ["emergency contacts", "emergency contact", "next of kin"],
  },
  {
    href: "/help-now",
    title: "Help Now",
    path: "Help Now",
    blurb: "Help Now gives urgent steps and how to reach help quickly.",
    keywords: ["help now", "urgent help"],
  },
  {
    href: "/emergency-card",
    title: "Emergency card",
    path: "Emergency card",
    blurb: "The emergency card shows your key details for bystanders and clinicians.",
    keywords: ["emergency card", "medical id", "emergency details card"],
  },
  {
    href: "/supplies",
    title: "Supply tracker",
    path: "Tools → Supply tracker",
    blurb: "The supply tracker shows stock levels and a days-left estimate for each item.",
    keywords: ["supplies", "supply tracker", "stock levels", "running low", "how much insulin left"],
  },
  {
    href: "/routines",
    title: "Routines",
    path: "Tools → Routines",
    blurb: "Routines holds saved workouts and meals you can start in one tap.",
    keywords: ["routines", "routine", "saved meals", "saved meal", "meal routine"],
  },
];

const NAVIGATION_INTENT_PATTERNS: readonly RegExp[] = [
  /\bwhere\b/i,
  /\bwhich (screen|page|tab|tool|part of the app)\b/i,
  /\bhow do i (find|get to|get|open|reach|change|set|turn|add|edit|see|view|check|log|record|connect|manage|update|remove|delete)\b/i,
  /\bcan'?t find\b/i,
  /\bcannot find\b/i,
  /\bi'?m lost\b/i,
  /\blooking for\b/i,
  /\bshow me\b/i,
  /\btake me to\b/i,
  /\bgo to\b/i,
  /\bnavigate\b/i,
  /\bfind (my|the|me)\b/i,
];

/** Messages that belong to the safety interceptor, never to navigation. */
const ACUTE_SELF_REPORT_PATTERNS: readonly RegExp[] = [
  /\bi'?m (having|low|going low|hypo)/i,
  /\bi am (having|low|going low)/i,
  /\bi feel (low|faint|dizzy|shaky|unwell)/i,
  /\bhaving a hypo\b/i,
  /\bpassed out\b/i,
  /\bpassing out\b/i,
  /\bunconscious\b/i,
  /\bseizure\b/i,
  /\bfitting\b/i,
  /\bvomiting\b/i,
  /\bcan'?t keep (fluids|water) down\b/i,
  /\bketones? (are |is )?(high|raised|positive)\b/i,
  /\bcall 999\b/i,
  /\bambulance\b/i,
  /\bsuicid/i,
  /\bkill myself\b/i,
  /\bself[-\s]?harm/i,
];

export function hasNavigationIntent(message: string): boolean {
  return NAVIGATION_INTENT_PATTERNS.some((re) => re.test(message));
}

export function hasAcuteSelfReport(message: string): boolean {
  return ACUTE_SELF_REPORT_PATTERNS.some((re) => re.test(message));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordHits(text: string, words: string[], keyword: string): boolean {
  const parts = keyword.toLowerCase().split(" ").filter(Boolean);
  if (!parts.length) return false;
  if (parts.length > 1) return text.includes(parts.join(" "));
  const token = parts[0]!;
  return words.some((word) => word === token || (token.length >= 5 && word.startsWith(token)));
}

function scoreDestination(text: string, words: string[], destination: AppNavigationDestination): number {
  let score = 0;
  for (const keyword of destination.keywords) {
    if (keywordHits(text, words, keyword)) score += keyword.length;
  }
  return score;
}

function parentHubAction(destination: AppNavigationDestination): CoachAction | null {
  if (destination.href.startsWith("/tools/")) return { label: "Open Tools", href: "/tools" };
  if (destination.href.startsWith("/scenarios/")) return { label: "Open Guides", href: "/scenarios" };
  if (destination.href.startsWith("/settings/")) return { label: "Open Settings", href: "/settings" };
  if (destination.href.startsWith("/community/")) return { label: "Open Feed", href: "/community" };
  return null;
}

function ageGate(destination: AppNavigationDestination, ageYears: number | null | undefined): "allowed" | "underage" | "unknown-age" {
  if (destination.minAge == null) return "allowed";
  if (ageYears == null || !Number.isFinite(ageYears)) return "unknown-age";
  return ageYears >= destination.minAge ? "allowed" : "underage";
}

const HUB_FALLBACK_ACTIONS: CoachAction[] = [
  { label: "Open Tools", href: "/tools" },
  { label: "Open Guides", href: "/scenarios" },
  { label: "Open Settings", href: "/settings" },
];

/**
 * Deterministic reply for a navigation question, or null when the message
 * is better handled by the safety interceptor or the LLM.
 */
export function matchAppNavigation(
  message: string,
  opts?: { ageYears?: number | null },
): CoachReply | null {
  if (typeof message !== "string") return null;
  if (hasAcuteSelfReport(message)) return null;
  if (!hasNavigationIntent(message)) return null;

  const text = normalize(message);
  if (text.length < 3) return null;
  const words = text.split(" ").filter(Boolean);

  let best: AppNavigationDestination | null = null;
  let bestScore = 0;
  let bestKeyword = 0;
  for (const destination of APP_NAVIGATION_DESTINATIONS) {
    if (!ALLOWED_HREFS.includes(destination.href)) continue;
    let longest = 0;
    for (const keyword of destination.keywords) {
      if (keywordHits(text, words, keyword)) longest = Math.max(longest, keyword.length);
    }
    const score = scoreDestination(text, words, destination);
    if (score < 4) continue;
    if (score > bestScore || (score === bestScore && longest > bestKeyword)) {
      best = destination;
      bestScore = score;
      bestKeyword = longest;
    }
  }

  if (!best) {
    return {
      reply:
        "Most things live in one of three places. Tools (bottom tab) holds calculators, logs, and trackers. Guides (bottom tab) holds step-by-step help for specific moments. Account → Settings holds your setup, CGM connection, and notifications. Tap one below to jump there, or tell me the thing you are looking for and I will point you to the exact screen.",
      suggestedQuestions: [],
      suggestedNextActions: HUB_FALLBACK_ACTIONS,
      deferToTeam: false,
    };
  }

  const gate = ageGate(best, opts?.ageYears);
  if (gate === "unknown-age") {
    return {
      reply: `The ${best.title} sits under ${best.path}. It opens once your date of birth is saved, and I can't see one on your profile yet. Add it under Account → Settings → Personal & usage, then the guide will be available. Tap below to open that screen.`,
      suggestedQuestions: [],
      suggestedNextActions: [{ label: "Open Personal & usage", href: "/settings/usage" }],
      deferToTeam: false,
    };
  }
  if (gate === "underage") {
    return {
      reply: `The ${best.title} sits under ${best.path}. That guide is for people aged ${best.minAge} and over, so it stays closed on your profile. The other guides are open under Guides (bottom tab). Tap below to browse them.`,
      suggestedQuestions: [],
      suggestedNextActions: [{ label: "Open Guides", href: "/scenarios" }],
      deferToTeam: false,
    };
  }

  const actions: CoachAction[] = [{ label: `Open ${best.title}`, href: best.href }];
  const parent = parentHubAction(best);
  if (parent && parent.href !== best.href) actions.push(parent);

  return {
    reply: `${best.title} is under ${best.path}. ${best.blurb} Tap “Open ${best.title}” below and it takes you straight there.`,
    suggestedQuestions: [],
    suggestedNextActions: actions,
    deferToTeam: false,
  };
}
