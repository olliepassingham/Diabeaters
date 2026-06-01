import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import {
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  type CommunityPostRow,
  type CommunityTopicId,
  type FeedCursor,
} from "@/lib/community";
import { getActiveAppMode } from "@/lib/carer-session";
import type { ProfileRow } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { scheduleCommunityRoutePrefetch } from "@/lib/demo-route-prefetch";

export const COMMUNITY_FEED_QUERY_ROOT = "community-feed" as const;

/** First page size for main feed (matches community home). */
export const MAIN_FEED_PAGE_SIZE = 12;

/** Keep prefetched / revisiting feed instant without stale UI for too long. */
export const COMMUNITY_FEED_STALE_MS = 90_000;

const FEED_TAB_STORAGE_KEY = "diabeater.community.feed_tab";

export type MainFeedTab = "everyone" | "following";

export type CommunityFeedQueryKey = readonly [
  typeof COMMUNITY_FEED_QUERY_ROOT,
  string,
  string,
  string,
  string,
  string,
  string,
  "saved" | "all",
];

export function readStoredMainFeedTab(): MainFeedTab {
  if (typeof window === "undefined") return "everyone";
  try {
    const raw = window.localStorage.getItem(FEED_TAB_STORAGE_KEY);
    if (raw === "following" || raw === "everyone") return raw;
  } catch {
    /* ignore */
  }
  return "everyone";
}

/** Scope string passed to `FeedPostList` — must stay in sync with community home. */
export function buildMainFeedScopeKey(options: {
  feedTab?: MainFeedTab;
  topicFilter?: CommunityTopicId | null;
  savedOnly?: boolean;
  feedSearch?: string;
  feedListKey?: number;
}): string {
  const feedTab = options.feedTab ?? "everyone";
  const topicFilter = options.topicFilter ?? null;
  const savedOnly = options.savedOnly ?? false;
  const feedSearch = options.feedSearch?.trim() ?? "";
  const feedListKey = options.feedListKey ?? 0;
  return ["main", feedTab, topicFilter ?? "_", savedOnly ? "s" : "a", feedSearch, String(feedListKey)].join(
    ":",
  );
}

/** React Query key for `FeedPostList` — shared with startup prefetch. */
export function buildCommunityFeedQueryKey(params: {
  scopeKey: string;
  viewerId: string;
  feedTab?: MainFeedTab;
  topicFilter?: CommunityTopicId | null;
  debouncedSearch?: string;
  useServerSearch?: boolean;
  authorIdsForServerSearch?: string[] | null;
  savedOnly?: boolean;
}): CommunityFeedQueryKey {
  const authorIds = (params.authorIdsForServerSearch ?? []).slice().sort().join(",");
  return [
    COMMUNITY_FEED_QUERY_ROOT,
    params.scopeKey,
    params.viewerId,
    params.useServerSearch ? "search" : params.feedTab ?? "everyone",
    params.topicFilter ?? "",
    params.debouncedSearch ?? "",
    authorIds,
    params.savedOnly ? "saved" : "all",
  ];
}

export function getCommunityFeedNextPageParam(
  lastPage: CommunityPostRow[] | undefined,
  pageSize: number,
): FeedCursor | undefined {
  if (!lastPage?.length || lastPage.length < pageSize) return undefined;
  const last = lastPage[lastPage.length - 1];
  if (!last) return undefined;
  return { created_at: last.created_at, id: last.id };
}

/** Community-only session (feed landing, not patient/carer with a link). */
export function isCommunityMemberSession(opts: {
  hasCarerLink: boolean;
  cloudProfile?: ProfileRow | null;
}): boolean {
  if (opts.hasCarerLink) return false;
  const mode = getActiveAppMode();
  if (mode === "patient" || mode === "carer") return false;
  if (mode === "community") return true;
  if (opts.cloudProfile?.account_type === "community") return true;
  return isCommunityAccountProfile(storage.getProfile());
}

async function fetchMainFeedPage(
  feedTab: MainFeedTab,
  pageSize: number,
  cursor: FeedCursor | null,
  topicFilter: CommunityTopicId | null,
): Promise<CommunityPostRow[]> {
  const res =
    feedTab === "everyone"
      ? await fetchCommunityPostsPage(pageSize, cursor, topicFilter)
      : await fetchCommunityPostsFromFollowingPage(pageSize, cursor, topicFilter);
  if (res.error) throw res.error;
  return res.data ?? [];
}

/**
 * Seed React Query with the main community feed so `/community` can paint from cache.
 */
export async function prefetchMainCommunityFeed(
  queryClient: QueryClient,
  viewerId: string,
  options?: {
    feedTab?: MainFeedTab;
    feedListKey?: number;
  },
): Promise<void> {
  if (!isSupabaseConfigured() || !viewerId) return;

  const feedTab = options?.feedTab ?? "everyone";
  const feedListKey = options?.feedListKey ?? 0;
  const scopeKey = buildMainFeedScopeKey({ feedTab, feedListKey });
  const queryKey = buildCommunityFeedQueryKey({
    scopeKey,
    viewerId,
    feedTab,
  });

  const existing = queryClient.getQueryData<InfiniteData<CommunityPostRow[]>>(queryKey);
  if (existing?.pages?.[0]?.length) return;

  await queryClient.prefetchInfiniteQuery({
    queryKey,
    initialPageParam: null as FeedCursor | null,
    staleTime: COMMUNITY_FEED_STALE_MS,
    gcTime: 10 * 60_000,
    queryFn: async ({ pageParam }) => fetchMainFeedPage(feedTab, MAIN_FEED_PAGE_SIZE, pageParam, null),
    getNextPageParam: (lastPage) => getCommunityFeedNextPageParam(lastPage, MAIN_FEED_PAGE_SIZE),
  });
}

/** Prefetch the tab the user last had open (Everyone + Following when stored). */
export async function prefetchMainCommunityFeedsForViewer(
  queryClient: QueryClient,
  viewerId: string,
): Promise<void> {
  const storedTab = readStoredMainFeedTab();
  await prefetchMainCommunityFeed(queryClient, viewerId, { feedTab: "everyone" });
  if (storedTab === "following") {
    await prefetchMainCommunityFeed(queryClient, viewerId, { feedTab: "following" });
  }
}

/**
 * After app gate: warm community JS chunks and optionally the feed query cache.
 */
export function scheduleCommunityWarmup(
  queryClient: QueryClient,
  viewerId: string | undefined,
  options?: { prefetchFeedData?: boolean },
): void {
  if (typeof window === "undefined") return;

  scheduleCommunityRoutePrefetch();

  if (!viewerId || !options?.prefetchFeedData) return;

  const runData = () => {
    void prefetchMainCommunityFeedsForViewer(queryClient, viewerId);
  };

  window.requestAnimationFrame(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(runData, { timeout: 2500 });
    } else {
      window.setTimeout(runData, 600);
    }
  });
}
