import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Play, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FeedFollowSuggestionsStrip } from "@/components/community/feed-follow-suggestions-strip";
import { FeedWatchLearnPlayer } from "@/components/community/feed-watch-learn-player";
import { FeedStoriesComposerHeader } from "@/components/community/feed-stories-composer-header";
import { FeedPostList } from "@/components/community/feed-post-list";
import { StoryCreateSheet } from "@/components/community/story-create-sheet";
import { StoryViewerDialog, buildStoryViewerQueue, type StoryViewerEntry } from "@/components/community/story-viewer-dialog";
import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FeedComposerSheet } from "@/components/community/feed-composer-sheet";
import { FindPeoplePanel } from "@/components/community/find-people-panel";
import { FeedMoreMenu } from "@/components/community/feed-more-menu";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { useFeedComposer } from "@/hooks/use-feed-composer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  fetchFollowSuggestions,
  fetchRecentCommunityVideoPosts,
  followUser,
  listFolloweeIdsForCurrentUser,
  type CommunityTopicId,
  type FeedCursor,
  type CommunityPostRow,
  type CommunityStoryRow,
  type FollowSuggestion,
  fetchStoryById,
} from "@/lib/community";
import { pickStoryToOpen } from "@/lib/community/stories-supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProfilesByIds, searchPublicProfilesForFeedQuery, useProfile, canEngageWithCommunityFeed, needsCommunityProfileSetup } from "@/lib/profile";
import { COMMUNITY_PROFILE_SETUP_PATH } from "@/lib/community-landing";
import { prefetchProfileAvatarUrls } from "@/lib/storage-profile";
import { CommunityProfileReminderCard } from "@/components/community-profile-reminder-card";
import {
  dismissCommunityFeedProfileReminder,
  shouldShowCommunityFeedProfileReminder,
} from "@/lib/community-profile-prompt";
import {
  dismissFeedSuggestions,
  isFeedSuggestionsDismissed,
} from "@/lib/community/feed-suggestions-dismiss";
import {
  buildMainFeedScopeKey,
  COMMUNITY_FEED_QUERY_ROOT,
  MAIN_FEED_PAGE_SIZE,
  prependPostedToCommunityFeed,
  revokeOptimisticPostMedia,
} from "@/lib/community-feed-cache";
import { getAppScrollMain, getAppScrollTop, setAppScrollTop } from "@/lib/app-scroll";
import { CommunityPushPromptDialog } from "@/components/community-push-prompt-dialog";
import { useCommunityPushPromptAfterOnboarding } from "@/hooks/use-community-push-prompt-after-onboarding";
import { getActiveAppMode, isCommunitySessionMode } from "@/lib/carer-session";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { cn } from "@/lib/utils";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type FeedTab = "everyone" | "following";

const FEED_TAB_STORAGE_KEY = "diabeater.community.feed_tab";

function readStoredFeedTab(): FeedTab {
  if (typeof window === "undefined") return "everyone";
  try {
    const raw = window.localStorage.getItem(FEED_TAB_STORAGE_KEY);
    if (raw === "following" || raw === "everyone") return raw;
  } catch {
    /* ignore */
  }
  return "everyone";
}

const PAGE_SIZE = MAIN_FEED_PAGE_SIZE;

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { communityPushPromptOpen, setCommunityPushPromptOpen } = useCommunityPushPromptAfterOnboarding();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCommunityMode = isCommunitySessionMode(hasCarerLink, activeMode, {
    localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
    cloudCommunityProfile: profile?.account_type === "community",
  });
  const [feedTab, setFeedTab] = useState<FeedTab>(() => readStoredFeedTab());
  /** `null` = all topics. */
  const [topicFilter, setTopicFilter] = useState<CommunityTopicId | null>(null);
  const [feedSearch, setFeedSearch] = useState("");

  const [feedListRevision, setFeedListRevision] = useState(0);
  const [pendingFeedPosts, setPendingFeedPosts] = useState<CommunityPostRow[]>([]);
  const dropPendingFeedPost = useCallback((pendingId: string) => {
    setPendingFeedPosts((prev) => {
      for (const post of prev) {
        if (post.id === pendingId) revokeOptimisticPostMedia(post);
      }
      return prev.filter((post) => post.id !== pendingId);
    });
  }, []);
  const feedComposer = useFeedComposer({
    closeSheetOnPost: true,
    onOptimisticPost: (post) => {
      setPendingFeedPosts((prev) => [post, ...prev.filter((row) => row.id !== post.id)]);
      getAppScrollMain()?.scrollTo({ top: 0, behavior: "smooth" });
    },
    onOptimisticFailed: dropPendingFeedPost,
    onPosted: (post, pendingId) => {
      if (pendingId) dropPendingFeedPost(pendingId);
      if (post) {
        prependPostedToCommunityFeed(queryClient, post);
        if (!pendingId) getAppScrollMain()?.scrollTo({ top: 0, behavior: "smooth" });
      }
      void queryClient.invalidateQueries({ queryKey: [COMMUNITY_FEED_QUERY_ROOT] });
      setFeedListRevision((k) => k + 1);
    },
  });
  const orderedTopics = feedComposer.formBodyProps.orderedTopics;

  const [peopleOpen, setPeopleOpen] = useState(false);
  const [suggested, setSuggested] = useState<FollowSuggestion[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);
  const [followBusyIds, setFollowBusyIds] = useState<Record<string, boolean>>({});
  /** Current user’s followees — loaded on feed mount for suggestion strip + Find people. */
  const [followeeIds, setFolloweeIds] = useState<Set<string>>(() => new Set());
  const [followeesLoading, setFolloweesLoading] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [followingAuthorIds, setFollowingAuthorIds] = useState<string[] | null>(null);
  const [searchMatchedAuthorIds, setSearchMatchedAuthorIds] = useState<string[] | null>(null);
  const [scrollByTab, setScrollByTab] = useState<Record<FeedTab, number>>({ everyone: 0, following: 0 });
  const [showProfileReminder, setShowProfileReminder] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [watchLearnPosts, setWatchLearnPosts] = useState<CommunityPostRow[]>([]);
  const [watchLearnLoading, setWatchLearnLoading] = useState(false);
  const [watchLearnOpen, setWatchLearnOpen] = useState(false);
  const [watchLearnStartId, setWatchLearnStartId] = useState<string | null>(null);
  const [storyFolloweeIds, setStoryFolloweeIds] = useState<string[]>([]);
  const [storyPeople, setStoryPeople] = useState<
    { id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerInitialIndex, setStoryViewerInitialIndex] = useState(0);
  const [storyViewerEntriesOverride, setStoryViewerEntriesOverride] = useState<StoryViewerEntry[] | null>(null);
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (!user?.id || profileLoading) {
      setShowProfileReminder(false);
      return;
    }
    // Patients/supporters may browse the Feed without a public profile; show a soft reminder.
    // Community members are redirected to setup instead (below).
    if (isCommunityMode) {
      setShowProfileReminder(false);
      return;
    }
    setShowProfileReminder(shouldShowCommunityFeedProfileReminder(user.id, profile));
  }, [user?.id, profile, profileLoading, isCommunityMode]);

  useEffect(() => {
    if (!user?.id) {
      setSuggestionsDismissed(false);
      return;
    }
    setSuggestionsDismissed(isFeedSuggestionsDismissed(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (profileLoading) return;
    if (!isCommunityMode) return;
    if (!needsCommunityProfileSetup(profile)) return;
    setLocation(COMMUNITY_PROFILE_SETUP_PATH);
  }, [profile, profileLoading, setLocation, isCommunityMode]);

  // Preserve scroll position across Everyone / Following toggles (app main scroll container).
  useEffect(() => {
    const scrollEl = getAppScrollMain();
    if (!scrollEl) return;
    const onScroll = () => {
      const y = scrollEl.scrollTop;
      setScrollByTab((prev) => (prev[feedTab] === y ? prev : { ...prev, [feedTab]: y }));
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [feedTab]);

  useEffect(() => {
    const y = scrollByTab[feedTab] ?? 0;
    window.requestAnimationFrame(() => setAppScrollTop(y, "auto"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedTab]);

  const feedCacheScope = useMemo(
    () => buildMainFeedScopeKey({ feedTab, topicFilter, savedOnly, feedSearch }),
    [feedTab, topicFilter, savedOnly, feedSearch],
  );

  const hasFeedHandle = feedComposer.hasFeedHandle;
  const canComposeToFeed = feedComposer.canComposeToFeed;
  const canEngageWithFeed = !profileLoading && canEngageWithCommunityFeed(profile);

  // Deep-link support: /community?saved=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(search.replace(/^\?/, ""));
      const saved = params.get("saved");
      if (saved === "1" || saved === "true") {
        setSavedOnly(true);
        setTopicFilter(null);
      }
    } catch {
      // ignore
    }
    // Only on mount; user interactions should control state afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync so "Saved posts" feels like a real place users can return to.
  useEffect(() => {
    try {
      const params = new URLSearchParams(search.replace(/^\?/, ""));
      if (savedOnly) {
        params.set("saved", "1");
      } else {
        params.delete("saved");
      }
      const next = `${pathname.split("?")[0]}${params.toString() ? `?${params.toString()}` : ""}`;
      if (next !== pathname) setLocation(next);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOnly]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FEED_TAB_STORAGE_KEY, feedTab);
    } catch {
      // ignore
    }
  }, [feedTab]);

  const fetchFeedPage = useCallback(
    (limit: number, cursor: FeedCursor | null) =>
      feedTab === "everyone"
        ? fetchCommunityPostsPage(limit, cursor, topicFilter, true)
        : fetchCommunityPostsFromFollowingPage(limit, cursor, topicFilter),
    [feedTab, topicFilter],
  );

  useEffect(() => {
    if (!user?.id) {
      setWatchLearnPosts([]);
      setWatchLearnLoading(false);
      return;
    }
    let cancelled = false;
    setWatchLearnLoading(true);
    void fetchRecentCommunityVideoPosts(20).then((res) => {
      if (cancelled) return;
      setWatchLearnLoading(false);
      if (res.error || !res.data) {
        setWatchLearnPosts([]);
        return;
      }
      setWatchLearnPosts(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, feedListRevision]);

  useEffect(() => {
    if (!user?.id || feedTab !== "following") {
      setFollowingAuthorIds(null);
      return;
    }
    let cancelled = false;
    void listFolloweeIdsForCurrentUser().then((res) => {
      if (cancelled) return;
      if (res.error) {
        setFollowingAuthorIds([user.id]);
        return;
      }
      setFollowingAuthorIds([...new Set([user.id, ...(res.ids ?? [])])]);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, feedTab]);

  useEffect(() => {
    if (!user?.id) {
      setStoryFolloweeIds([]);
      return;
    }
    let cancelled = false;
    void listFolloweeIdsForCurrentUser().then((res) => {
      if (cancelled) return;
      if (res.error) {
        setStoryFolloweeIds([user.id]);
        return;
      }
      setStoryFolloweeIds([...new Set([user.id, ...(res.ids ?? [])])]);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const { storiesByAuthor, loading: storiesLoading, refresh: refreshStories } = useCommunityStories(
    user?.id,
    storyFolloweeIds,
  );

  const selfStoryPerson = useMemo(() => {
    if (!user?.id || !profile) return null;
    return {
      id: user.id,
      name: profile.full_name?.trim() || "You",
      avatar_url: profile.avatar_url ?? null,
    };
  }, [user?.id, profile?.full_name, profile?.avatar_url]);

  const storyFolloweeIdsOnly = useMemo(
    () => storyFolloweeIds.filter((id) => id !== user?.id),
    [storyFolloweeIds, user?.id],
  );

  useEffect(() => {
    if (storyFolloweeIdsOnly.length === 0) {
      setStoryPeople([]);
      return;
    }
    let cancelled = false;
    void getProfilesByIds(storyFolloweeIdsOnly).then((map) => {
      if (cancelled) return;
      const people = storyFolloweeIdsOnly
        .map((id) => {
          const p = map.get(id);
          if (!p) return null;
          return {
            id,
            name: p.full_name?.trim() || id.slice(0, 8),
            avatar_url: p.avatar_url ?? null,
          };
        })
        .filter((x): x is { id: string; name: string; avatar_url: string | null } => x != null);
      setStoryPeople(people);
      prefetchProfileAvatarUrls(
        people.map((p) => p.avatar_url),
        { preloadImages: 8 },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [storyFolloweeIdsOnly.join(",")]);

  const storyViewerQueue = useMemo(
    () => buildStoryViewerQueue(selfStoryPerson, storyPeople, storiesByAuthor),
    [selfStoryPerson, storyPeople, storiesByAuthor],
  );

  const openStory = useCallback(
    (authorId: string, story?: CommunityStoryRow, displayName?: string) => {
      const isSelf = authorId === user?.id;
      const isFollowee = storyFolloweeIds.includes(authorId);
      if (!isSelf && !isFollowee) return;

      const queueIdx = story
        ? storyViewerQueue.findIndex((e) => e.story?.id === story.id)
        : storyViewerQueue.findIndex((e) => e.authorId === authorId);
      if (queueIdx >= 0) {
        setStoryViewerEntriesOverride(null);
        setStoryViewerInitialIndex(queueIdx);
      } else {
        const person = storyPeople.find((p) => p.id === authorId);
        const authorAvatarUrl =
          authorId === user?.id
            ? selfStoryPerson?.avatar_url ?? profile?.avatar_url ?? null
            : person?.avatar_url ?? null;
        setStoryViewerEntriesOverride([
          {
            authorId,
            story: story ?? pickStoryToOpen(storiesByAuthor.get(authorId) ?? []) ?? null,
            authorDisplayName: displayName ?? person?.name ?? undefined,
            authorAvatarUrl,
          },
        ]);
        setStoryViewerInitialIndex(0);
      }
      setStoryViewerOpen(true);
    },
    [user?.id, storyFolloweeIds, storyViewerQueue, storyPeople, storiesByAuthor, selfStoryPerson, profile?.avatar_url],
  );

  useEffect(() => {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(raw);
    const storyId = params.get("story");
    if (!storyId?.trim() || !user?.id) return;
    let cancelled = false;
    void fetchStoryById(storyId.trim()).then((res) => {
      if (cancelled || !res.data) return;
      openStory(res.data.author_id, res.data);
      params.delete("story");
      const next = params.toString();
      setLocation(next ? `${pathname}?${next}` : pathname, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [search, user?.id, openStory, pathname, setLocation]);

  useEffect(() => {
    const q = feedSearch.trim();
    if (q.length < 2) {
      setSearchMatchedAuthorIds(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await searchPublicProfilesForFeedQuery(q, 18);
        if (cancelled) return;
        if (res.error) {
          setSearchMatchedAuthorIds(null);
          return;
        }
        // When Following tab is active, restrict author matches to people you follow (+self).
        if (feedTab === "following" && followingAuthorIds && followingAuthorIds.length > 0) {
          const allow = new Set(followingAuthorIds);
          setSearchMatchedAuthorIds(res.ids.filter((id) => allow.has(id)));
          return;
        }
        setSearchMatchedAuthorIds(res.ids);
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [feedSearch, feedTab, followingAuthorIds]);

  /** Optional `?draft=` for short shared links (dashboard uses localStorage draft instead). */
  useEffect(() => {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(raw);
    const qDraft = params.get("draft");
    if (qDraft == null || !qDraft.trim()) return;
    feedComposer.formBodyProps.setComposer(qDraft.trim());
    params.delete("draft");
    const next = params.toString();
    setLocation(next ? `${pathname}?${next}` : pathname, { replace: true });
  }, [search, setLocation, pathname]);

  useEffect(() => {
    if (!user?.id) {
      setFolloweeIds(new Set());
      setFolloweesLoading(false);
      return;
    }
    let cancelled = false;
    setFolloweesLoading(true);
    void listFolloweeIdsForCurrentUser().then((res) => {
      if (cancelled) return;
      setFolloweesLoading(false);
      if (res.error) {
        setFolloweeIds(new Set());
        return;
      }
      setFolloweeIds(new Set(res.ids));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!peopleOpen || !user?.id) return;
    let cancelled = false;
    void listFolloweeIdsForCurrentUser().then((res) => {
      if (cancelled || res.error) return;
      setFolloweeIds((prev) => {
        const next = new Set(res.ids);
        if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [peopleOpen, user?.id]);

  const loadSuggestedPeople = useCallback(async () => {
    if (!user?.id) return;
    setSuggestedLoading(true);
    const res = await fetchFollowSuggestions(user.id, 12);
    if (!res.error) setSuggested(res.data);
    else setSuggested([]);
    setSuggestedLoading(false);
    setSuggestionsFetched(true);
  }, [user?.id]);

  const refreshSuggestedForFindPeople = useCallback(() => {
    if (!user?.id || suggestedLoading || suggestionsFetched) return;
    void loadSuggestedPeople();
  }, [user?.id, suggestedLoading, suggestionsFetched, loadSuggestedPeople]);

  // Discovery — deferred until idle; fetch once so the strip does not flash repeatedly.
  useEffect(() => {
    if (!user?.id || suggestionsFetched) return;
    if (savedOnly || feedSearch.trim()) return;

    let cancelled = false;
    let idleId = 0;
    let timeoutId = 0;

    const load = () => {
      if (cancelled) return;
      void loadSuggestedPeople();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(load, { timeout: 4000 });
    } else {
      timeoutId = window.setTimeout(load, 2000);
    }

    return () => {
      cancelled = true;
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user?.id, savedOnly, feedSearch, suggestionsFetched, loadSuggestedPeople]);

  async function handleFollow(id: string) {
    if (!user?.id) {
      toast({ title: "Sign in to follow", variant: "destructive" });
      return;
    }
    if (!canEngageWithFeed) {
      toast({
        title: "Set up your public profile",
        description: "Add a display name and @handle before following people.",
      });
      setLocation(COMMUNITY_PROFILE_SETUP_PATH);
      return;
    }
    if (followeeIds.has(id)) return;
    setFollowBusyIds((prev) => ({ ...prev, [id]: true }));
    const res = await followUser(id);
    setFollowBusyIds((prev) => ({ ...prev, [id]: false }));
    if (res.error) {
      const msg = res.error.message.toLowerCase();
      const already =
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        msg.includes("23505") ||
        msg.includes("already exists");
      if (already) {
        setFolloweeIds((prev) => new Set(prev).add(id));
        toast({ title: "Already following", description: "You’re already following this person." });
        return;
      }
      toast({ title: "Follow failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setFolloweeIds((prev) => new Set(prev).add(id));
    setSuggested((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Following", description: "You’ll now see their posts in Following." });
  }

  useEffect(() => {
    if (!feedComposer.composerExpandSignal) return;
    feedComposer.setSheetOpen(true);
  }, [feedComposer.composerExpandSignal, feedComposer.setSheetOpen]);

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="mx-auto max-w-lg space-y-6">
        <PageHeader title="Community" screenReaderOnly />
        <EmptyState
          title="Community needs Supabase"
          description="Connect Supabase in your environment to use the community."
        />
      </PageShell>
    );
  }

  const needsPublicSetup = !profileLoading && needsCommunityProfileSetup(profile);
  // Community members must finish profile before the Feed; patients can browse with a soft prompt.
  if (isCommunityMode && needsPublicSetup) {
    return null;
  }

  const activeFilterLabel = [
    savedOnly ? "Saved" : null,
    topicFilter ? orderedTopics.find((topic) => topic.id === topicFilter)?.label ?? null : null,
    feedSearch.trim() || null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const filtersActive = Boolean(activeFilterLabel);
  const clearFeedFilters = () => {
    setTopicFilter(null);
    setSavedOnly(false);
    setFeedSearch("");
  };

  const feedHeaderActions = (
    <div className="flex shrink-0 items-center justify-end gap-1" data-testid="feed-toolbar-actions">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="h-11 shrink-0 rounded-xl px-2.5 text-muted-foreground hover:text-foreground sm:px-3"
        onClick={() => setPeopleOpen(true)}
        data-testid="button-find-people"
        aria-label="Find people"
      >
        <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden text-sm font-medium sm:inline">Find people</span>
      </Button>
      {user ? <FeedMoreMenu /> : null}
    </div>
  );

  return (
    <PageShell variant="full" density="compact" className="space-y-2 pb-2 pt-0">
      <PageHeader title="Community" screenReaderOnly />

      {user && !savedOnly && !feedSearch.trim() ? (
        <FeedStoriesComposerHeader
          self={selfStoryPerson}
          people={storyPeople}
          storiesByAuthor={storiesByAuthor}
          loading={storiesLoading}
          onOpenStory={openStory}
          onAddStory={() => setStoryCreateOpen(true)}
          composerPreview={feedComposer.pillPreview}
          avatarDisplayName={feedComposer.avatarDisplayName}
          avatarPath={feedComposer.avatarPath}
          profileHref={feedComposer.profileHref}
          endActions={feedHeaderActions}
          onComposerClick={() => {
            if (!canComposeToFeed) {
              toast({
                title: "Set up your public profile",
                description: "Add a display name and @handle to post on the Feed.",
              });
              setLocation(COMMUNITY_PROFILE_SETUP_PATH);
              return;
            }
            feedComposer.setSheetOpen(true);
          }}
          composerDisabled={!canComposeToFeed}
        />
      ) : (
        <div className="flex justify-end">{feedHeaderActions}</div>
      )}

      {showProfileReminder && user?.id ? (
        <CommunityProfileReminderCard
          onDismiss={() => {
            dismissCommunityFeedProfileReminder(user.id);
            setShowProfileReminder(false);
          }}
        />
      ) : null}

      <FindPeoplePanel
        open={peopleOpen}
        onOpenChange={setPeopleOpen}
        userId={user?.id}
        followeeIds={followeeIds}
        followeesLoading={followeesLoading}
        followBusyIds={followBusyIds}
        onFollow={(id) => void handleFollow(id)}
        suggested={suggested}
        suggestedLoading={suggestedLoading}
        suggestionsFetched={suggestionsFetched}
        onRefreshSuggested={refreshSuggestedForFindPeople}
        onStoryClick={(id, story, name) => openStory(id, story, name)}
      />

      <StoryViewerDialog
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
        viewerId={user?.id}
        entries={storyViewerEntriesOverride ?? storyViewerQueue}
        initialIndex={storyViewerInitialIndex}
        onViewed={() => refreshStories()}
      />
      <StoryCreateSheet
        open={storyCreateOpen}
        onOpenChange={setStoryCreateOpen}
        onPosted={() => refreshStories()}
      />

      <FeedComposerSheet
        open={feedComposer.sheetOpen}
        onOpenChange={feedComposer.setSheetOpen}
        pillPreview={feedComposer.pillPreview}
        avatarDisplayName={feedComposer.avatarDisplayName}
        avatarPath={feedComposer.avatarPath}
        profileHref={feedComposer.profileHref}
        formBodyProps={feedComposer.formBodyProps}
        onSubmit={feedComposer.handlePost}
        showPill={false}
        pillTestId="feed-composer-mobile-pill"
        formTestId="feed-composer-form-sheet"
        extras={feedComposer.composerExtras}
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Tabs
            value={watchLearnOpen ? "watch" : feedTab}
            onValueChange={(v) => {
              if (v === "watch") {
                setWatchLearnStartId(watchLearnPosts[0]?.id ?? null);
                setWatchLearnOpen(true);
                return;
              }
              setWatchLearnOpen(false);
              setScrollByTab((prev) => ({ ...prev, [feedTab]: getAppScrollTop() }));
              setFeedTab(v as FeedTab);
            }}
            className="min-w-0 flex-1 sm:flex-none"
          >
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-full bg-muted/50 p-1 dark:bg-muted/30 sm:h-9 sm:w-[21rem]">
              <TabsTrigger
                value="following"
                className="rounded-full px-2 text-[13px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Following
              </TabsTrigger>
              <TabsTrigger
                value="everyone"
                className="rounded-full px-2 text-[13px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Everyone
              </TabsTrigger>
              <TabsTrigger
                value="watch"
                aria-label="Watch and learn"
                className="gap-1 rounded-full px-2 text-[13px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                Watch
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={filtersActive ? "secondary" : "outline"}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full sm:h-9 sm:w-9"
                aria-expanded={filtersOpen}
                aria-label="Filter feed"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-border/60 p-0 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <p className="text-sm font-semibold tracking-tight">Filter</p>
                {filtersActive ? (
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-primary"
                    onClick={clearFeedFilters}
                  >
                    Clear
                  </button>
                ) : (
                  <span className="text-[13px] text-muted-foreground">All posts</span>
                )}
              </div>
              <div className="max-h-[min(70dvh,28rem)] space-y-4 overflow-y-auto p-4">
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={feedSearch}
                    onChange={(e) => setFeedSearch(e.target.value)}
                    placeholder="Search posts…"
                    className="h-11 rounded-xl border-border/70 bg-muted/30 pl-9 pr-3"
                    aria-label="Search posts"
                    title="Search posts (header search finds people by @handle)"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5">
                  <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm font-medium">Saved posts</span>
                  <Switch
                    checked={savedOnly}
                    data-testid="button-saved-filter-desktop"
                    aria-label={savedOnly ? "Saved posts filter on" : "Show saved posts"}
                    onCheckedChange={(checked) => {
                      setSavedOnly(checked);
                      if (checked) setTopicFilter(null);
                    }}
                  />
                </label>
                <div>
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Topics
                  </p>
                  <div role="group" aria-label="Feed topics" className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      aria-pressed={topicFilter === null && !savedOnly}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        topicFilter === null && !savedOnly
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/70 bg-background text-foreground/80 hover:bg-muted/50",
                      )}
                      onClick={() => {
                        setTopicFilter(null);
                        setSavedOnly(false);
                      }}
                    >
                      All topics
                    </button>
                    {orderedTopics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        aria-pressed={topicFilter === topic.id && !savedOnly}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-left text-[13px] font-medium transition-colors",
                          topicFilter === topic.id && !savedOnly
                            ? "border-foreground bg-foreground text-background"
                            : "border-border/70 bg-background text-foreground/80 hover:bg-muted/50",
                        )}
                        onClick={() => {
                          setTopicFilter(topic.id);
                          setSavedOnly(false);
                        }}
                      >
                        {topic.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {filtersActive ? (
          <div className="flex h-8 w-fit max-w-full items-center rounded-full bg-muted pl-3 pr-0.5 text-xs font-medium text-foreground">
            <button type="button" className="min-w-0 truncate" onClick={() => setFiltersOpen(true)}>
              {activeFilterLabel}
            </button>
            <button
              type="button"
              className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Clear feed filters"
              onClick={clearFeedFilters}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {user && !savedOnly && !feedSearch.trim() && !suggestionsDismissed && (suggestedLoading || suggested.length > 0) ? (
        <FeedFollowSuggestionsStrip
          suggestions={suggested}
          loading={suggestedLoading && suggested.length === 0}
          followeeIds={followeeIds}
          followBusyIds={followBusyIds}
          onFollow={(id) => void handleFollow(id)}
          onFindPeople={() => setPeopleOpen(true)}
          onDismiss={() => {
            if (!user?.id) return;
            dismissFeedSuggestions(user.id);
            setSuggestionsDismissed(true);
          }}
        />
      ) : null}

      <div className="min-w-0">
      <FeedPostList
        viewerId={user?.id}
        canEngageWithFeed={canEngageWithFeed}
        scopeKey={feedCacheScope}
        searchQuery={feedSearch}
        pageSize={PAGE_SIZE}
        topicsForSelect={orderedTopics}
        feedTab={feedTab}
        topicFilter={topicFilter}
        followingAuthorIds={followingAuthorIds}
        searchMatchedAuthorIds={searchMatchedAuthorIds}
        savedOnly={savedOnly}
        feedListRevision={feedListRevision}
        pendingPosts={pendingFeedPosts}
        onOpenFindPeople={() => setPeopleOpen(true)}
        onSwitchToEveryone={() => {
          setFeedTab("everyone");
          setTopicFilter(null);
          setSavedOnly(false);
        }}
        onClearSearch={() => setFeedSearch("")}
        onExploreTopicInEveryone={(tid) => {
          setFeedTab("everyone");
          setTopicFilter(tid);
          setSavedOnly(false);
        }}
        emptyStateTitle={feedTab === "following" ? "Your Following feed is quiet" : "Be the first to post"}
        emptyStateDescription={
          feedTab === "following"
            ? topicFilter
              ? "No posts in this topic from people you follow yet. Try All topics or follow a few more people."
              : "Follow a few people from Everyone, or share something yourself to get things started."
            : topicFilter
              ? "No posts in this topic yet. Switch topics — or start the conversation."
              : "Share a tip, a win, or a question. The community grows with every post."
        }
        fetchPage={fetchFeedPage}
        onStoryPosted={() => refreshStories()}
      />
      </div>
      <FeedWatchLearnPlayer
        open={watchLearnOpen}
        onOpenChange={setWatchLearnOpen}
        posts={watchLearnPosts}
        loading={watchLearnLoading}
        initialIndex={Math.max(
          0,
          watchLearnPosts.findIndex((post) => post.id === watchLearnStartId),
        )}
        viewerId={user?.id}
        canEngage={canEngageWithFeed}
      />
      <CommunityPushPromptDialog
        open={communityPushPromptOpen}
        onOpenChange={setCommunityPushPromptOpen}
      />
    </PageShell>
  );
}
