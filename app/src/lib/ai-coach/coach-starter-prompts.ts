import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import { storage } from "@/lib/storage";

export type CoachTimeBand = "morning" | "afternoon" | "evening" | "night";

export type CoachStarterSignal =
  | CoachTimeBand
  | "sick-day"
  | "travel"
  | "pump-failure"
  | "low-supplies"
  | "has-supplies";

export type CoachStarterContext = {
  timeBand: CoachTimeBand;
  sickDayActive: boolean;
  travelModeActive: boolean;
  pumpFailureActive: boolean;
  suppliesLow: boolean;
  hasTrackedSupplies: boolean;
};

type StarterEntry = {
  text: string;
  /** Boost score when any signal matches the current context. Untagged entries are always eligible. */
  boost?: CoachStarterSignal[];
};

const STARTER_COUNT = 3;

const STARTER_POOLS: Record<CoachTopicSlug, StarterEntry[]> = {
  general: [
    { text: "What should I bring to a routine diabetes clinic appointment?", boost: ["morning", "afternoon"] },
    { text: "How can I describe glucose patterns to my team without focusing on exact numbers?" },
    { text: "What questions are useful to ask about sick day rules before I need them?" },
    { text: "What is dawn phenomenon in broad, educational terms?", boost: ["morning"] },
    { text: "What evening checks do people often discuss with their team before sleep?", boost: ["evening", "night"] },
    { text: "How can I prepare talking points when supplies are running low?", boost: ["low-supplies", "has-supplies"] },
    { text: "What topics are worth raising with my team when travel is coming up?", boost: ["travel"] },
    { text: "How can I think about food and activity in general terms with my clinic?", boost: ["afternoon", "evening"] },
    { text: "What follow-up habits help between routine appointments?", boost: ["morning", "afternoon"] },
  ],
  exercise: [
    { text: "What topics are worth discussing with my team before I change how I exercise?" },
    { text: "How can I think about food and fluids around activity in general terms?", boost: ["afternoon", "evening"] },
    { text: "What symptoms during activity mean I should stop and get urgent medical help?" },
    { text: "How might my team talk about recovery and late lows after exercise?", boost: ["evening", "night"] },
    { text: "What should I track to make exercise conversations with my clinic more useful?", boost: ["morning"] },
    { text: "How can I plan a gentle return to activity after being unwell?", boost: ["sick-day"] },
  ],
  "sick-day": [
    { text: "When should I contact my diabetes team urgently versus routine advice?" },
    { text: "What information about fluids, food, and ketones is helpful to track when unwell?" },
    { text: "How can I prepare a simple sick day kit at home?", boost: ["morning", "afternoon"] },
    { text: "What signs often mean I should seek urgent medical help when unwell?" },
    { text: "How can I explain sick day patterns to my team without exact dosing detail?", boost: ["evening"] },
    { text: "What questions help when I'm not sure whether to keep normal meal routines?", boost: ["afternoon"] },
  ],
  travel: [
    { text: "What documents or packing habits help at airport security with diabetes supplies?" },
    { text: "How might time zones come up when I talk to my clinic about trips?" },
    { text: "What backup supplies are often discussed for travel in broad terms?", boost: ["low-supplies", "has-supplies"] },
    { text: "How can I plan a pre-travel checklist conversation with my diabetes team?", boost: ["morning", "afternoon"] },
    { text: "What might jet lag or schedule shifts mean in general educational terms?", boost: ["evening", "night"] },
    { text: "How do people usually discuss hypo safety while travelling?", boost: ["travel"] },
  ],
  clinic: [
    { text: "How can I summarise recent patterns in a short clinic appointment?", boost: ["morning", "afternoon"] },
    { text: "What follow-up questions help after a pump or CGM conversation?" },
    { text: "How can I ask about sick day or travel planning during a routine visit?" },
    { text: "What should I bring or have ready on my phone before an appointment?", boost: ["morning"] },
    { text: "How can I discuss recurring hypos or highs constructively with my team?" },
    { text: "What lifestyle topics are worth a quick mention if time is short?", boost: ["afternoon", "evening"] },
  ],
  hypo: [
    { text: "What is the broad role of fast-acting carbohydrate during hypoglycaemia?" },
    { text: "When might it be appropriate to involve someone else or emergency services after a severe hypo?" },
    { text: "How can I discuss recurring hypos constructively with my care team?" },
    { text: "What might help me explain a recent hypo pattern without exact numbers?", boost: ["evening", "night"] },
    { text: "How do educators usually frame prevention conversations in general terms?", boost: ["morning", "afternoon"] },
    { text: "What should supporters know about helping during a hypo without taking over?", boost: ["evening"] },
  ],
  bedtime: [
    { text: "What evening checks are commonly discussed for overnight peace of mind?", boost: ["evening", "night"] },
    { text: "How can I tell typical variation from patterns worth mentioning to my team?" },
    { text: "What sleep-related factors affect glucose that are worth learning about?" },
    { text: "How might exercise earlier in the day come up in evening conversations?", boost: ["evening"] },
    { text: "What broad topics help when glucose feels unsettled at bedtime?", boost: ["night"] },
    { text: "How can I prepare questions about overnight safety for my next clinic visit?", boost: ["morning", "afternoon"] },
  ],
  driving: [
    { text: "Why do clinics often emphasise checking glucose before driving?", boost: ["morning", "afternoon"] },
    { text: "What might be useful to keep in the vehicle related to diabetes safety?" },
    { text: "How can I plan breaks on long journeys as a topic for my care team?" },
    { text: "What general principles do educators mention about hypos and driving?", boost: ["morning"] },
    { text: "How can I discuss driving rules or limits openly with my diabetes team?" },
    { text: "What might late evening lows mean for planning the next morning's drive?", boost: ["evening", "night"] },
  ],
  alcohol: [
    { text: "Why can alcohol affect glucose for many hours after drinking?" },
    { text: "What safety principles do educators often mention around alcohol and diabetes?" },
    { text: "How can I discuss alcohol openly with my care team?" },
    { text: "What evening or night-time topics often come up around alcohol and glucose?", boost: ["evening", "night"] },
    { text: "How might supporters help without judging or taking over someone's plan?", boost: ["evening"] },
    { text: "What questions are useful before a social event where alcohol might be involved?", boost: ["afternoon", "evening"] },
  ],
  "pump-failure": [
    { text: "What should a written pump-failure or infusion-set backup plan typically cover?" },
    { text: "What supplies are worth keeping accessible every day if I use a pump?", boost: ["has-supplies", "low-supplies"] },
    { text: "How can I rehearse or review these steps with my care team before something goes wrong?" },
    { text: "What signs might mean an infusion problem rather than a simple high?", boost: ["pump-failure"] },
    { text: "How do clinics usually talk about switching to injections temporarily in broad terms?" },
    { text: "What should I note down to explain a pump issue at my next appointment?", boost: ["morning", "afternoon"] },
  ],
  supporter: [
    { text: "How can I support someone going through a hypo without taking over their plan?" },
    { text: "What questions could I prepare for a clinic visit on their behalf?", boost: ["morning", "afternoon"] },
    { text: "What signs would mean I should call urgent care or emergency services for them?" },
    { text: "How can I help with evening routines without becoming the decision-maker?", boost: ["evening", "night"] },
    { text: "What is useful to know when they are unwell or on a sick day?", boost: ["sick-day"] },
    { text: "How might I support travel preparation without packing for them?", boost: ["travel"] },
  ],
};

export function coachHourToTimeBand(hour: number): CoachTimeBand {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function buildCoachStarterContext(now: Date = new Date()): CoachStarterContext {
  const scenario = storage.getScenarioState();
  const supplies = storage.getSupplies();
  let suppliesLow = false;
  const hasTrackedSupplies = supplies.length > 0;

  for (const supply of supplies) {
    const quantity = storage.getAdjustedQuantity(supply);
    const daysRemaining = storage.getDaysRemaining(supply);
    if (quantity <= 0 || (Number.isFinite(daysRemaining) && daysRemaining <= 7)) {
      suppliesLow = true;
      break;
    }
  }

  return {
    timeBand: coachHourToTimeBand(now.getHours()),
    sickDayActive: scenario.sickDayActive,
    travelModeActive: scenario.travelModeActive,
    pumpFailureActive: Boolean(scenario.pumpFailureActive),
    suppliesLow,
    hasTrackedSupplies,
  };
}

function activeSignals(ctx: CoachStarterContext): Set<CoachStarterSignal> {
  const signals = new Set<CoachStarterSignal>([ctx.timeBand]);
  if (ctx.sickDayActive) signals.add("sick-day");
  if (ctx.travelModeActive) signals.add("travel");
  if (ctx.pumpFailureActive) signals.add("pump-failure");
  if (ctx.suppliesLow) signals.add("low-supplies");
  if (ctx.hasTrackedSupplies) signals.add("has-supplies");
  return signals;
}

/** Deterministic 32-bit hash for stable daily rotation. */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scoreStarter(entry: StarterEntry, signals: Set<CoachStarterSignal>): number {
  if (!entry.boost?.length) return 1;
  let score = 0;
  for (const tag of entry.boost) {
    if (signals.has(tag)) score += 3;
  }
  return score > 0 ? score : 1;
}

function dayKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Pick contextual starter questions for the empty chat state.
 * Rotates daily (stable within a day) and boosts prompts that match time-of-day and active guides.
 */
export function pickCoachStarterPrompts(
  topic: CoachTopicSlug,
  ctx: CoachStarterContext,
  opts?: { userId?: string | null; now?: Date },
): string[] {
  const pool = STARTER_POOLS[topic];
  if (!pool?.length) return [];

  const now = opts?.now ?? new Date();
  const signals = activeSignals(ctx);
  const seed = hashSeed(`${topic}:${opts?.userId ?? "anon"}:${dayKey(now)}:${[...signals].sort().join(",")}`);
  const rand = mulberry32(seed);

  const ranked = pool
    .map((entry, index) => ({
      entry,
      index,
      score: scoreStarter(entry, signals),
      tie: rand(),
    }))
    .sort((a, b) => b.score - a.score || b.tie - a.tie || a.index - b.index);

  const picked: string[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.entry.text)) continue;
    seen.add(row.entry.text);
    picked.push(row.entry.text);
    if (picked.length >= STARTER_COUNT) break;
  }

  return picked;
}

export function getCoachStarterPoolSize(topic: CoachTopicSlug): number {
  return STARTER_POOLS[topic]?.length ?? 0;
}
