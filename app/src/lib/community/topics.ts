/** Fixed feed categories (mirrors DB check constraint on `community_posts.topic`). */
export const COMMUNITY_TOPICS = [
  { id: "holidays-travel", label: "Holidays & Travel" },
  { id: "sick-days", label: "Feeling Unwell / Sick Days" },
  { id: "exercise-activity", label: "Exercise & Activity" },
  { id: "food-eating-out", label: "Food & Eating Out" },
  { id: "mental-health", label: "Mental Health & Burnout" },
  { id: "tips-what-worked", label: "Tips & What Worked for Me" },
  { id: "general-questions", label: "General Questions" },
] as const;

export type CommunityTopicId = (typeof COMMUNITY_TOPICS)[number]["id"];

const TOPIC_IDS = new Set<string>(COMMUNITY_TOPICS.map((t) => t.id));

export const DEFAULT_COMMUNITY_TOPIC: CommunityTopicId = "general-questions";

export function isCommunityTopicId(value: string): value is CommunityTopicId {
  return TOPIC_IDS.has(value);
}

export function communityTopicLabel(id: string): string {
  const row = COMMUNITY_TOPICS.find((t) => t.id === id);
  return row?.label ?? "General Questions";
}
