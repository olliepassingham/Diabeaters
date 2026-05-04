import { ageInWholeYearsUtc } from "../user-age";

/** Fixed feed categories (mirrors DB check constraint on `community_posts.topic`). */
export const COMMUNITY_TOPICS = [
  { id: "holidays-travel", label: "Holidays & Travel" },
  { id: "sick-days", label: "Feeling Unwell / Sick Days" },
  { id: "exercise-activity", label: "Exercise & Activity" },
  { id: "food-eating-out", label: "Food & Eating Out" },
  { id: "mental-health", label: "Mental Health & Burnout" },
  { id: "tips-what-worked", label: "Tips & What Worked for Me" },
  { id: "general-questions", label: "General Questions" },
  { id: "school-college-life", label: "School & college life" },
  { id: "family-supporters", label: "Family & supporters" },
] as const;

export type CommunityTopicId = (typeof COMMUNITY_TOPICS)[number]["id"];

export type CommunityTopicRow = (typeof COMMUNITY_TOPICS)[number];

const TOPIC_IDS = new Set<string>(COMMUNITY_TOPICS.map((t) => t.id));

export const DEFAULT_COMMUNITY_TOPIC: CommunityTopicId = "general-questions";

export function isCommunityTopicId(value: string): value is CommunityTopicId {
  return TOPIC_IDS.has(value);
}

export function communityTopicLabel(id: string): string {
  const row = COMMUNITY_TOPICS.find((t) => t.id === id);
  return row?.label ?? "General Questions";
}

export type OrderedTopicsInput = {
  /**
   * Linked supporter browsing in supporter mode — topics emphasise caring for someone
   * with diabetes (takes precedence over school-age ordering).
   */
  supporterFeed: boolean;
  /** Signed-in account DOB (`profiles.date_of_birth`), YYYY-MM-DD. */
  dateOfBirth: string | null | undefined;
};

/**
 * Topic chips / composer order: supporter lens first when relevant; otherwise boost
 * school & college when we know the viewer is under ~typical undergrad age (<23).
 */
export function orderedCommunityTopicsForViewer(input: OrderedTopicsInput): readonly CommunityTopicRow[] {
  if (input.supporterFeed) {
    return reorderTopics([
      "family-supporters",
      "mental-health",
      "sick-days",
      "tips-what-worked",
      "general-questions",
      "food-eating-out",
      "exercise-activity",
      "school-college-life",
      "holidays-travel",
    ]);
  }

  const age = ageInWholeYearsUtc(input.dateOfBirth);
  if (age != null && age < 23) {
    return reorderTopics([
      "school-college-life",
      "mental-health",
      "exercise-activity",
      "food-eating-out",
      "tips-what-worked",
      "general-questions",
      "sick-days",
      "holidays-travel",
      "family-supporters",
    ]);
  }

  return COMMUNITY_TOPICS;
}

function reorderTopics(preferredIds: CommunityTopicId[]): CommunityTopicRow[] {
  const seen = new Set<CommunityTopicId>();
  const out: CommunityTopicRow[] = [];
  for (const id of preferredIds) {
    const row = COMMUNITY_TOPICS.find((t) => t.id === id);
    if (row && !seen.has(id)) {
      seen.add(id);
      out.push(row);
    }
  }
  for (const row of COMMUNITY_TOPICS) {
    if (!seen.has(row.id)) out.push(row);
  }
  return out;
}
