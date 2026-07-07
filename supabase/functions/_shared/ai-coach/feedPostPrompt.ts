/**
 * Scheduled Beatie feed posts — curated educational conversation starters.
 *
 * v1: rotate pre-approved templates by UTC day-of-year; optional light LLM rephrase
 * in `beatie_feed_post_cron` (falls back to template verbatim on LLM failure).
 *
 * @see docs/operations/beatie_feed_bot_setup.md
 */

export const FEED_POST_TOPIC_IDS = [
  "holidays-travel",
  "sick-days",
  "exercise-activity",
  "food-eating-out",
  "mental-health",
  "tips-what-worked",
  "general-questions",
  "school-college-life",
  "family-supporters",
] as const;

export type FeedPostTopicId = (typeof FEED_POST_TOPIC_IDS)[number];

export type FeedPostTemplate = {
  topic: FeedPostTopicId;
  body: string;
};

/** Pre-approved starters — educational prompts only; no dosing or treatment directives. */
export const FEED_POST_TEMPLATES: FeedPostTemplate[] = [
  {
    topic: "general-questions",
    body:
      "What is one thing about living with type 1 that you wish more people understood? No right answer — just curious what comes up for you.",
  },
  {
    topic: "tips-what-worked",
    body:
      "Share a small routine or habit that has made diabetes days a bit easier for you lately. It might help someone else trying something new.",
  },
  {
    topic: "mental-health",
    body:
      "Diabetes can be heavy on the head as well as the body. What is one thing that has helped your mood or motivation this week, even a little?",
  },
  {
    topic: "exercise-activity",
    body:
      "How do you think about snacks or quick carbs before or after exercise? What has worked for you — and what has not?",
  },
  {
    topic: "food-eating-out",
    body:
      "Eating out with type 1 can be a puzzle. What is your go-to approach when the menu is unfamiliar or portions are unclear?",
  },
  {
    topic: "holidays-travel",
    body:
      "Packing for a day out or a short trip: what do you always make sure is in your bag? Share your essentials list.",
  },
  {
    topic: "sick-days",
    body:
      "When you are feeling unwell, what is the first thing you check or do for your diabetes (before anything else)? General tips only — everyone's plan differs.",
  },
  {
    topic: "school-college-life",
    body:
      "If you are at school, college, or uni: what is one thing that helps you manage diabetes around classes, exams, or social life?",
  },
  {
    topic: "family-supporters",
    body:
      "Supporters and family: what is one helpful thing someone has done for you around diabetes — or one thing you wish they understood better?",
  },
  {
    topic: "general-questions",
    body:
      "What is a diabetes question you had when you were newly diagnosed that you would answer differently now?",
  },
  {
    topic: "tips-what-worked",
    body:
      "What is one app feature, tool, or paper checklist you actually use — not the one you think you should use?",
  },
  {
    topic: "mental-health",
    body:
      "Burnout happens. If you have been through a rough patch with diabetes admin, what helped you reset (even temporarily)?",
  },
  {
    topic: "exercise-activity",
    body:
      "Team sport, gym, walking, or dancing — how do you decide when to pause, push on, or call it a day? Stories welcome.",
  },
  {
    topic: "food-eating-out",
    body:
      "Breakfast on the go: what do you reach for when time is tight? Share ideas that are realistic, not perfect.",
  },
  {
    topic: "holidays-travel",
    body:
      "Time zones and travel days can feel chaotic. What is one thing you do to keep supplies organised when you are on the move?",
  },
  {
    topic: "sick-days",
    body:
      "Hydration, rest, checking more often — what are your gentle reminders to yourself on a sick day? (Not medical advice — share what you do.)",
  },
  {
    topic: "school-college-life",
    body:
      "Who at school or college knows about your diabetes, and how did you decide what to tell them? Optional share — no pressure.",
  },
  {
    topic: "family-supporters",
    body:
      "If you support someone with type 1: what is one question you are glad you asked their diabetes team?",
  },
  {
    topic: "general-questions",
    body:
      "CGM alarms, finger sticks, or both — how do you balance staying informed with getting enough sleep?",
  },
  {
    topic: "tips-what-worked",
    body:
      "What is one low-effort win from this month? Could be a better bedtime routine, a new snack, or just getting through a tough week.",
  },
  {
    topic: "mental-health",
    body:
      "Sometimes the numbers look fine but you still feel off. How do you notice that in yourself, and what do you do next?",
  },
  {
    topic: "exercise-activity",
    body:
      "Cold weather workouts: anything you change about kit, warm-up, or glucose checks? UK winter stories especially welcome.",
  },
  {
    topic: "food-eating-out",
    body:
      "Celebrations and cake: how do you enjoy food socially without turning it into an all-or-nothing moment?",
  },
  {
    topic: "holidays-travel",
    body:
      "Flying or long journeys: what do you keep in hand luggage vs hold? Practical packing tips only.",
  },
  {
    topic: "sick-days",
    body:
      "When you cannot eat normally, how do you keep fluids and quick carbs within reach? Share what you stock at home.",
  },
  {
    topic: "school-college-life",
    body:
      "Exam season stress — did diabetes add an extra layer for you? What helped you get through (sleep, snacks, talking to someone)?",
  },
  {
    topic: "family-supporters",
    body:
      "Partners and housemates: what is one small way they can be helpful without taking over your diabetes decisions?",
  },
];

export const FEED_POST_BODY_MAX_CHARS = 600;

export function dayOfYearUtc(d: Date = new Date()): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / (24 * 60 * 60 * 1000));
}

export function selectFeedPostTemplateForUtcDate(d: Date = new Date()): FeedPostTemplate {
  if (FEED_POST_TEMPLATES.length === 0) {
    return {
      topic: "general-questions",
      body: "What is one small win with diabetes this week? Share if you would like to.",
    };
  }
  const idx = dayOfYearUtc(d) % FEED_POST_TEMPLATES.length;
  return FEED_POST_TEMPLATES[idx]!;
}

export function clampFeedPostBody(s: string, maxLen = FEED_POST_BODY_MAX_CHARS): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  let bestEnd = -1;
  for (const sep of [". ", "! ", "? "] as const) {
    const i = slice.lastIndexOf(sep);
    if (i > bestEnd) bestEnd = i;
  }
  if (bestEnd >= Math.min(120, Math.floor(maxLen * 0.35))) {
    return slice.slice(0, bestEnd + 1).trim();
  }
  const sp = slice.lastIndexOf(" ");
  if (sp >= 80) return `${slice.slice(0, sp).trim()}…`;
  return `${slice.trimEnd()}…`;
}

export const AI_FEED_POST_SYSTEM_PROMPT = `You are "Beatie", the educational diabetes guide for the Diabeaters community feed.

# Your task
You receive a **pre-approved template** post (topic + body). Return JSON with a **reply** field containing a **lightly rephrased** version of the template for variety.

# Hard rules (same spirit as private Beatie)
- Educational support only — **not** medical advice, diagnosis, or care-team replacement.
- **Never** recommend, calculate, or estimate a specific insulin dose, basal rate, carb ratio, ISF, or personal glucose target.
- Do not interpret CGM readings as directives to treat.
- Do not diagnose or interpret labs clinically.
- If the template touches acute crisis topics, keep the post general and encourage Help Now / emergency services for urgent situations — do not give step-by-step home treatment.
- Avoid shaming or moralising. Use neutral, supportive language.

# Length (required)
- **2–4 sentences** plus an optional inviting question at the end.
- Stay under **~600 characters** total in **reply**.
- No markdown headings, no bullet lists, no numbered care plans.
- No "As an AI…" preamble.

# Output
Return the standard JSON object (reply, suggestedQuestions, suggestedNextActions, deferToTeam).
- **reply** is the only field used — write it as a **standalone community post**.
- **suggestedQuestions** / **suggestedNextActions**: prefer empty arrays.
- Set **deferToTeam: true** only if the template would need clinical specifics to be safe.

# Tone
UK-oriented type 1 diabetes education. Plain language. Warm and inviting. Prefer no emojis.`;

export function buildFeedPostRephraseUserMessage(template: FeedPostTemplate): string {
  return [
    `TOPIC: ${template.topic}`,
    "",
    "TEMPLATE BODY:",
    template.body,
    "",
    "Rephrase lightly for variety. Keep the same meaning, topic, and inviting question. Do not add medical advice.",
  ].join("\n");
}
