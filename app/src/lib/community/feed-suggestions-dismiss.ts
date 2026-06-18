const KEY_PREFIX = "diabeater.community.feed_suggestions_dismissed";

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`;
}

export function isFeedSuggestionsDismissed(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function dismissFeedSuggestions(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* quota / private mode */
  }
}
