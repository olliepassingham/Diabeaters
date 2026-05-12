import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";

export const COACH_TOPIC_SLUGS = [
  "general",
  "exercise",
  "sick-day",
  "travel",
  "clinic",
  "hypo",
  "bedtime",
  "driving",
  "alcohol",
  "pump-failure",
  "supporter",
] as const;

export type CoachTopicSlug = (typeof COACH_TOPIC_SLUGS)[number];

const TOPIC_CONFIG: Record<
  CoachTopicSlug,
  { label: string; emptyHint: string; starters: string[] }
> = {
  general: {
    label: "General",
    emptyHint:
      `Ask a general question about type 1 diabetes, or ask how to prepare for a clinic visit. ${AI_ASSISTANT_NAME} cannot suggest doses or interpret CGM trends as treatment instructions.`,
    starters: [
      "What should I bring to a routine diabetes clinic appointment?",
      "How can I describe glucose patterns to my team without focusing on exact numbers?",
      "What questions are useful to ask about sick day rules before I need them?",
    ],
  },
  exercise: {
    label: "Exercise",
    emptyHint:
      "Educational prompts about planning conversations with your care team. This is not exercise prescription or insulin dosing advice.",
    starters: [
      "What topics are worth discussing with my team before I change how I exercise?",
      "How can I think about food and fluids around activity in general terms?",
      "What symptoms during activity mean I should stop and get urgent medical help?",
    ],
  },
  "sick-day": {
    label: "Sick day",
    emptyHint:
      "Background on what to track and when to escalate — not a substitute for your clinic’s sick day plan.",
    starters: [
      "When should I contact my diabetes team urgently versus routine advice?",
      "What information about fluids, food, and ketones is helpful to track when unwell?",
      "How can I prepare a simple sick day kit at home?",
    ],
  },
  travel: {
    label: "Travel",
    emptyHint:
      "General preparation ideas for discussing travel with your team. Follow airline, security, and clinic guidance for your situation.",
    starters: [
      "What documents or packing habits help at airport security with diabetes supplies?",
      "How might time zones come up when I talk to my clinic about trips?",
      "What backup supplies are often discussed for travel in broad terms?",
    ],
  },
  clinic: {
    label: "Clinic visits",
    emptyHint:
      "Ways to prepare questions and follow-ups for appointments — not personal medical advice.",
    starters: [
      "How can I summarise recent patterns in a short clinic appointment?",
      "What follow-up questions help after a pump or CGM conversation?",
      "How can I ask about sick day or travel planning during a routine visit?",
    ],
  },
  hypo: {
    label: "Hypoglycaemia",
    emptyHint:
      "Educational framing only. For urgent symptoms, use Help Now or emergency services.",
    starters: [
      "What is the broad role of fast-acting carbohydrate during hypoglycaemia?",
      "When might it be appropriate to involve someone else or emergency services after a severe hypo?",
      "How can I discuss recurring hypos constructively with my care team?",
    ],
  },
  bedtime: {
    label: "Bedtime",
    emptyHint:
      "Evening routines people often discuss with their team — not instructions for your overnight settings.",
    starters: [
      "What evening checks are commonly discussed for overnight peace of mind?",
      "How can I tell typical variation from patterns worth mentioning to my team?",
      "What sleep-related factors affect glucose that are worth learning about?",
    ],
  },
  driving: {
    label: "Driving",
    emptyHint:
      "General awareness topics only — not legal limits or a judgement that you are safe to drive.",
    starters: [
      "Why do clinics often emphasise checking glucose before driving?",
      "What might be useful to keep in the vehicle related to diabetes safety?",
      "How can I plan breaks on long journeys as a topic for my care team?",
    ],
  },
  alcohol: {
    label: "Alcohol",
    emptyHint:
      "General education about alcohol and glucose — not personal drinking advice or dosing guidance.",
    starters: [
      "Why can alcohol affect glucose for many hours after drinking?",
      "What safety principles do educators often mention around alcohol and diabetes?",
      "How can I discuss alcohol openly with my care team?",
    ],
  },
  "pump-failure": {
    label: "Pump or infusion backup",
    emptyHint:
      "Questions to discuss with your clinic about backup plans and preparation — not dosing instructions for an active emergency.",
    starters: [
      "What should a written pump-failure or infusion-set backup plan typically cover?",
      "What supplies are worth keeping accessible every day if I use a pump?",
      "How can I rehearse or review these steps with my care team before something goes wrong?",
    ],
  },
  supporter: {
    label: "Supporter",
    emptyHint:
      "General education for someone supporting a person with type 1 diabetes in the UK. Not personal medical advice for them — never override their plan or care team.",
    starters: [
      "How can I support someone going through a hypo without taking over their plan?",
      "What questions could I prepare for a clinic visit on their behalf?",
      "What signs would mean I should call urgent care or emergency services for them?",
    ],
  },
};

export function normalizeCoachTopicParam(raw: string | null | undefined): CoachTopicSlug | null {
  if (raw == null) return null;
  const t = raw.trim().toLowerCase().replace(/_/g, "-");
  if ((COACH_TOPIC_SLUGS as readonly string[]).includes(t)) return t as CoachTopicSlug;
  return null;
}

export function getCoachTopicConfig(slug: CoachTopicSlug) {
  return TOPIC_CONFIG[slug];
}
