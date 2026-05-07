/** Minimum trimmed query length to use server search (`search_community_posts` RPC). */
export const FEED_SERVER_SEARCH_MIN_LEN = 2;

export function shouldUseFeedServerSearch(query: string): boolean {
  return query.trim().length >= FEED_SERVER_SEARCH_MIN_LEN;
}
