import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Bookmark, MessageCircle, Search as SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FeedFollowSuggestionsStrip } from "@/components/community/feed-follow-suggestions-strip";
import {
  FeedStoriesComposerHeader,
  FeedStoriesComposerHeaderForm,
} from "@/components/community/feed-stories-composer-header";
import { FeedPostList } from "@/components/community/feed-post-list";
import { StoryCreateSheet } from "@/components/community/story-create-sheet";
import { StoryViewerDialog } from "@/components/community/story-viewer-dialog";
import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FeedComposerFormBody } from "@/components/community/feed-composer-form-body";
import { FeedComposerSheet } from "@/components/community/feed-composer-sheet";
import { FindPeoplePanel } from "@/components/community/find-people-panel";
import { FeedMoreMenu } from "@/components/community/feed-more-menu";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { useFeedComposer } from "@/hooks/use-feed-composer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  isCommunityTopicId,
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  fetchFollowSuggestions,
  readFeedComposerDraft,
  followUser,
  listFolloweeIdsForCurrentUser,
  type CommunityTopicId,
  type FeedCursor,
  type CommunityStoryRow,
  type FollowSuggestion,
} from "@/lib/community";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProfilesByIds, searchPublicProfilesForFeedQuery, useProfile } from "@/lib/profile";
import { CommunityProfileReminderCard } from "@/components/community-profile-reminder-card";
import { CommunityProfileSetupPrompt } from "@/components/community-profile-setup-prompt";
import {
  dismissCommunityFeedProfileReminder,
  shouldShowCommunityFeedProfileReminder,
} from "@/lib/community-profile-prompt";
import {
  dismissFeedSuggestions,
  isFeedSuggestionsDismissed,
} from "@/lib/community/feed-suggestions-dismiss";
import { buildMainFeedScopeKey, MAIN_FEED_PAGE_SIZE } from "@/lib/community-feed-cache";
import { CommunityPushPromptDialog } from "@/components/community-push-prompt-dialog";
import { useCommunityPushPromptAfterOnboarding } from "@/hooks/use-community-push-prompt-after-onboarding";

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

function initialFeedComposerOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const draft = readFeedComposerDraft();
    if (draft?.body?.trim()) return true;
  } catch {
    /* ignore */
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia(`(max-width: 767px)`).matches
  ) {
    return false;
  }
  return window.matchMedia("(min-width: 768px)").matches;
}

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { communityPushPromptOpen, setCommunityPushPromptOpen } = useCommunityPushPromptAfterOnboarding();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const [feedTab, setFeedTab] = useState<FeedTab>(() => readStoredFeedTab());
  /** `null` = all topics. */
  const [topicFilter, setTopicFilter] = useState<CommunityTopicId | null>(null);
  const [feedSearch, setFeedSearch] = useState("");

  const [feedListKey, setFeedListKey] = useState(0);
  const [composerPanelOpen, setComposerPanelOpen] = useState(initialFeedComposerOpen);
  const isMobile = useIsMobile();
  const feedComposer = useFeedComposer({
    closeSheetOnPost: isMobile,
    onPosted: () => setFeedListKey((k) => k + 1),
  });
  const orderedTopics = feedComposer.formBodyProps.orderedTopics;

  const [peopleOpen, setPeopleOpen] = useState(false);
  const [suggested, setSuggested] = useState<FollowSuggestion[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [followBusyIds, setFollowBusyIds] = useState<Record<string, boolean>>({});
  /** Current user’s followees — refreshed when Find people opens so search results show Following vs Follow. */
  const [followeeIds, setFolloweeIds] = useState<Set<string>>(() => new Set());
  const [followeesLoading, setFolloweesLoading] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [feedSearchExpanded, setFeedSearchExpanded] = useState(false);
  const [followingAuthorIds, setFollowingAuthorIds] = useState<string[] | null>(null);
  const [searchMatchedAuthorIds, setSearchMatchedAuthorIds] = useState<string[] | null>(null);
  const [scrollByTab, setScrollByTab] = useState<Record<FeedTab, number>>({ everyone: 0, following: 0 });
  const [showProfileReminder, setShowProfileReminder] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [storyFolloweeIds, setStoryFolloweeIds] = useState<string[]>([]);
  const [storyPeople, setStoryPeople] = useState<
    { id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerAuthorId, setStoryViewerAuthorId] = useState<string | null>(null);
  const [storyViewerStory, setStoryViewerStory] = useState<CommunityStoryRow | null>(null);
  const [storyViewerName, setStoryViewerName] = useState<string | undefined>();
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || profileLoading) {
      setShowProfileReminder(false);
      return;
    }
    setShowProfileReminder(shouldShowCommunityFeedProfileReminder(user.id, profile));
  }, [user?.id, profile, profileLoading]);

  useEffect(() => {
    if (!user?.id) {
      setSuggestionsDismissed(false);
      return;
    }
    setSuggestionsDismissed(isFeedSuggestionsDismissed(user.id));
  }, [user?.id]);

  // Preserve scroll position across Everyone / Following toggles.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const y = window.scrollY ?? 0;
      setScrollByTab((prev) => (prev[feedTab] === y ? prev : { ...prev, [feedTab]: y }));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [feedTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const y = scrollByTab[feedTab] ?? 0;
    // Defer to next frame so layout is settled (prevents "jump then jump again" on mobile).
    window.requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: "auto" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedTab]);

  const feedCacheScope = useMemo(
    () => buildMainFeedScopeKey({ feedTab, topicFilter, savedOnly, feedSearch, feedListKey }),
    [feedTab, topicFilter, savedOnly, feedSearch, feedListKey],
  );

  const hasFeedHandle = feedComposer.hasFeedHandle;
  const canComposeToFeed = feedComposer.canComposeToFeed;

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
        ? fetchCommunityPostsPage(limit, cursor, topicFilter)
        : fetchCommunityPostsFromFollowingPage(limit, cursor, topicFilter),
    [feedTab, topicFilter],
  );

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
      setStoryPeople(
        storyFolloweeIdsOnly
          .map((id) => {
            const p = map.get(id);
            if (!p) return null;
            return {
              id,
              name: p.full_name?.trim() || id.slice(0, 8),
              avatar_url: p.avatar_url ?? null,
            };
          })
          .filter((x): x is { id: string; name: string; avatar_url: string | null } => x != null),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [storyFolloweeIdsOnly.join(",")]);

  const openStory = useCallback(
    (authorId: string, story?: CommunityStoryRow) => {
      const person =
        authorId === user?.id ? selfStoryPerson : storyPeople.find((p) => p.id === authorId);
      setStoryViewerAuthorId(authorId);
      setStoryViewerStory(story ?? storiesByAuthor.get(authorId) ?? null);
      setStoryViewerName(person?.name);
      setStoryViewerOpen(true);
    },
    [user?.id, selfStoryPerson, storyPeople, storiesByAuthor],
  );

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
    if (!peopleOpen) {
      setFolloweeIds(new Set());
      setFolloweesLoading(false);
      return;
    }
    if (!user?.id) {
      setFolloweeIds(new Set());
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
  }, [peopleOpen, user?.id]);

  const loadSuggestedPeople = useCallback(async () => {
    if (!user?.id) return;
    setSuggestedLoading(true);
    const res = await fetchFollowSuggestions(user.id, 12);
    if (!res.error) setSuggested(res.data);
    else setSuggested([]);
    setSuggestedLoading(false);
  }, [user?.id]);

  const refreshSuggestedForFindPeople = useCallback(() => {
    if (!user?.id || suggestedLoading || suggested.length > 0) return;
    void loadSuggestedPeople();
  }, [user?.id, suggestedLoading, suggested.length, loadSuggestedPeople]);

  // Discovery — deferred until idle so the feed load is not competing on weak WiFi.
  useEffect(() => {
    if (!user?.id) return;
    if (suggestedLoading || suggested.length > 0) return;
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
  }, [user?.id, savedOnly, feedSearch, suggestedLoading, suggested.length, loadSuggestedPeople]);

  async function handleFollow(id: string) {
    if (!user?.id) {
      toast({ title: "Sign in to follow", variant: "destructive" });
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
    if (isMobile) feedComposer.setSheetOpen(true);
    else setComposerPanelOpen(true);
  }, [feedComposer.composerExpandSignal, isMobile, feedComposer.setSheetOpen]);

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

  const needsPublicSetup = !profileLoading && profile && !profile.is_public;

  const feedHeaderActions = !needsPublicSetup ? (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="h-9 shrink-0 rounded-xl px-2.5 sm:px-3"
        onClick={() => setPeopleOpen(true)}
        data-testid="button-find-people"
        aria-label="Find people"
      >
        <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium sm:text-sm">Find people</span>
      </Button>
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl sm:hidden" asChild>
        <Link href="/community/messages" aria-label="Messages" title="Messages">
          <MessageCircle className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="hidden h-9 shrink-0 rounded-xl sm:inline-flex" asChild>
        <Link href="/community/messages" aria-label="Messages" title="Open messages">
          <MessageCircle className="h-4 w-4 mr-1.5" aria-hidden />
          <span>Messages</span>
        </Link>
      </Button>
      {user ? <FeedMoreMenu /> : null}
    </div>
  ) : null;

  return (
    <PageShell variant="full" density="compact" className="pb-2">
      <PageHeader title="Community" screenReaderOnly />

      {needsPublicSetup ? (
        <CommunityProfileSetupPrompt compact />
      ) : (
        <>
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
          onComposerClick={() => feedComposer.setSheetOpen(true)}
          composerDisabled={!canComposeToFeed}
          isMobile={isMobile}
          composerExpanded={composerPanelOpen}
          onComposerExpandedChange={setComposerPanelOpen}
          composerForm={
            <FeedStoriesComposerHeaderForm onSubmit={feedComposer.handlePost}>
              <FeedComposerFormBody {...feedComposer.formBodyProps} />
            </FeedStoriesComposerHeaderForm>
          }
          headerActions={feedHeaderActions}
        />
      ) : feedHeaderActions ? (
        <div className="mb-2 flex justify-end">{feedHeaderActions}</div>
      ) : null}

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
        onRefreshSuggested={refreshSuggestedForFindPeople}
        onStoryClick={(id) => openStory(id)}
      />

      <StoryViewerDialog
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
        authorId={storyViewerAuthorId}
        story={storyViewerStory}
        authorDisplayName={storyViewerName}
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
      />

      <div
        className={cn(
          "space-y-2 rounded-2xl border border-border/45 bg-card/90 p-2 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/80",
          "sticky top-0 z-20 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        )}
      >
        <Tabs
          value={feedTab}
          onValueChange={(v) => {
            // Save current tab scroll before switching.
            if (typeof window !== "undefined") {
              const y = window.scrollY ?? 0;
              setScrollByTab((prev) => ({ ...prev, [feedTab]: y }));
            }
            setFeedTab(v as FeedTab);
          }}
          className="w-full"
        >
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-full bg-muted/50 p-0.5 dark:bg-muted/35">
            <TabsTrigger
              value="following"
              className="rounded-full text-xs font-medium sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Following
            </TabsTrigger>
            <TabsTrigger
              value="everyone"
              className="rounded-full text-xs font-medium sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Everyone
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          role="tablist"
          aria-label="Feed topics"
          className="hidden flex-wrap gap-2 rounded-xl bg-muted/25 px-1 py-1.5 dark:bg-muted/15 sm:flex"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={topicFilter === null && !savedOnly}
            variant={topicFilter === null && !savedOnly ? "default" : "outline"}
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => {
              setTopicFilter(null);
              setSavedOnly(false);
            }}
          >
            All topics
          </Button>
          {orderedTopics.map((t) => (
            <Button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={topicFilter === t.id && !savedOnly}
              variant={topicFilter === t.id && !savedOnly ? "default" : "outline"}
              size="sm"
              className="max-w-[14rem] shrink-0 whitespace-normal rounded-full text-balance text-center leading-snug"
              onClick={() => {
                setTopicFilter(t.id);
                setSavedOnly(false);
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {isMobile && feedSearchExpanded ? (
          <div className="space-y-2">
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                placeholder="Search posts…"
                className="h-9 pl-9 pr-20"
                aria-label="Search posts"
                title="Search posts (header search finds people by @handle)"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                onClick={() => {
                  setFeedSearch("");
                  setFeedSearchExpanded(false);
                }}
              >
                Close
              </Button>
            </div>
            <div className="flex items-center gap-1.5 sm:hidden">
              <div className="min-w-0 flex-1">
                {savedOnly ? (
                  <div className="flex h-9 w-full items-center rounded-xl border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground">
                    Saved posts
                  </div>
                ) : (
                  <Select
                    value={topicFilter === null ? "__all" : topicFilter}
                    onValueChange={(v) => {
                      setSavedOnly(false);
                      if (v === "__all") setTopicFilter(null);
                      else if (isCommunityTopicId(v)) setTopicFilter(v);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full rounded-xl border-border/50 bg-background/80" aria-label="Feed topic">
                      <SelectValue placeholder="Topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All topics</SelectItem>
                      {orderedTopics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                type="button"
                variant={savedOnly ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-pressed={savedOnly}
                aria-label={savedOnly ? "Saved posts filter on" : "Show saved posts"}
                onClick={() => {
                  setSavedOnly((s) => {
                    const next = !s;
                    if (next) setTopicFilter(null);
                    return next;
                  });
                }}
              >
                <Bookmark className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="hidden items-center justify-end gap-2 sm:flex md:hidden">
              <Button
                type="button"
                variant={savedOnly ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-pressed={savedOnly}
                aria-label={savedOnly ? "Saved posts filter on" : "Show saved posts"}
                onClick={() => {
                  setSavedOnly((s) => {
                    const next = !s;
                    if (next) setTopicFilter(null);
                    return next;
                  });
                }}
              >
                <Bookmark className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        {isMobile && !feedSearchExpanded ? (
          <>
            <div className="flex items-center gap-1.5 sm:hidden">
              <div className="min-w-0 flex-1">
                {savedOnly ? (
                  <div className="flex h-9 w-full items-center rounded-xl border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground">
                    Saved posts
                  </div>
                ) : (
                  <Select
                    value={topicFilter === null ? "__all" : topicFilter}
                    onValueChange={(v) => {
                      setSavedOnly(false);
                      if (v === "__all") setTopicFilter(null);
                      else if (isCommunityTopicId(v)) setTopicFilter(v);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full rounded-xl border-border/50 bg-background/80" aria-label="Feed topic">
                      <SelectValue placeholder="Topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All topics</SelectItem>
                      {orderedTopics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                type="button"
                variant={savedOnly ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-pressed={savedOnly}
                aria-label={savedOnly ? "Saved posts filter on" : "Show saved posts"}
                onClick={() => {
                  setSavedOnly((s) => {
                    const next = !s;
                    if (next) setTopicFilter(null);
                    return next;
                  });
                }}
              >
                <Bookmark className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-label="Search posts"
                title="Search posts"
                onClick={() => setFeedSearchExpanded(true)}
              >
                <SearchIcon className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="hidden items-center justify-end gap-2 sm:flex md:hidden">
              <Button
                type="button"
                variant={savedOnly ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-pressed={savedOnly}
                aria-label={savedOnly ? "Saved posts filter on" : "Show saved posts"}
                onClick={() => {
                  setSavedOnly((s) => {
                    const next = !s;
                    if (next) setTopicFilter(null);
                    return next;
                  });
                }}
              >
                <Bookmark className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-label="Search posts"
                title="Search posts"
                onClick={() => setFeedSearchExpanded(true)}
              >
                <SearchIcon className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </>
        ) : null}

        {!isMobile ? (
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                placeholder="Search posts…"
                className="h-9 pl-9 pr-3"
                aria-label="Search posts"
                title="Search posts (header search finds people by @handle)"
              />
            </div>
            <Button
              type="button"
              variant={savedOnly ? "secondary" : "outline"}
              size="sm"
              className="h-9 shrink-0 rounded-full"
              aria-pressed={savedOnly}
              aria-label={savedOnly ? "Saved posts filter on" : "Show saved posts"}
              onClick={() => {
                setSavedOnly((s) => {
                  const next = !s;
                  if (next) setTopicFilter(null);
                  return next;
                });
              }}
              data-testid="button-saved-filter-desktop"
            >
              <Bookmark className="h-4 w-4 mr-2" aria-hidden />
              Saved
            </Button>
          </div>
        ) : null}
      </div>

      {user && !savedOnly && !feedSearch.trim() && !suggestionsDismissed ? (
        <FeedFollowSuggestionsStrip
          suggestions={suggested}
          loading={suggestedLoading}
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

      <div className="-mx-4 min-w-0 md:-mx-6">
      <FeedPostList
        key={feedListKey}
        viewerId={user?.id}
        scopeKey={feedCacheScope}
        searchQuery={feedSearch}
        pageSize={PAGE_SIZE}
        topicsForSelect={orderedTopics}
        showRefreshButton={!isMobile}
        feedTab={feedTab}
        topicFilter={topicFilter}
        followingAuthorIds={followingAuthorIds}
        searchMatchedAuthorIds={searchMatchedAuthorIds}
        savedOnly={savedOnly}
        feedListRevision={feedListKey}
        onOpenFindPeople={() => setPeopleOpen(true)}
        onSwitchToEveryone={() => {
          setFeedTab("everyone");
          setTopicFilter(null);
          setSavedOnly(false);
        }}
        onClearSearch={() => {
          setFeedSearch("");
          setFeedSearchExpanded(false);
        }}
        onExploreTopicInEveryone={(tid) => {
          setFeedTab("everyone");
          setTopicFilter(tid);
          setSavedOnly(false);
        }}
        emptyStateTitle="Nothing here yet"
        emptyStateDescription={
          feedTab === "following"
            ? topicFilter
              ? "No posts in this topic from people you follow yet. Try All topics or follow more profiles."
              : "No posts from people you follow yet. Follow profiles from the Everyone tab, or post something yourself."
            : topicFilter
              ? "No posts in this topic yet. Try another topic or be the first to post here."
              : "No posts yet. Be the first to post."
        }
        fetchPage={fetchFeedPage}
      />
      </div>
      <CommunityPushPromptDialog
        open={communityPushPromptOpen}
        onOpenChange={setCommunityPushPromptOpen}
      />
        </>
      )}
    </PageShell>
  );
}
