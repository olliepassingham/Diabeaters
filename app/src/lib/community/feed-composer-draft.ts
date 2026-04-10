import {
  DEFAULT_COMMUNITY_TOPIC,
  isCommunityTopicId,
  type CommunityTopicId,
} from "./topics";

export const FEED_COMPOSER_DRAFT_KEY = "diabeaters-feed-composer-draft-v1";

const MAX_DRAFT_BODY_CHARS = 8000;

/** Read persisted feed composer draft (body + topic). */
export function readFeedComposerDraft(): { body: string; topic: CommunityTopicId } | null {
  try {
    const raw = localStorage.getItem(FEED_COMPOSER_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown>;
    const body = typeof d.body === "string" ? d.body : "";
    const topicRaw = d.topic;
    const topic =
      typeof topicRaw === "string" && isCommunityTopicId(topicRaw)
        ? topicRaw
        : DEFAULT_COMMUNITY_TOPIC;
    return { body, topic };
  } catch {
    return null;
  }
}

/**
 * Save text to open in the community feed composer (same pipeline as typing on the feed).
 * Truncates to a safe max length.
 */
export function writeFeedComposerDraft(
  body: string,
  topic: CommunityTopicId = DEFAULT_COMMUNITY_TOPIC,
): void {
  try {
    const safe = body.slice(0, MAX_DRAFT_BODY_CHARS);
    localStorage.setItem(
      FEED_COMPOSER_DRAFT_KEY,
      JSON.stringify({
        body: safe,
        topic,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}
