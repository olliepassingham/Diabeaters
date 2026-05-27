import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Bookmark, ChevronDown, MessageCircle, Plus, Search as SearchIcon } from "lucide-react";
import { EmptyState, FeedLoadingSkeleton } from "@/components/empty-state";

const FeedPostList = lazy(() =>
  import("@/components/community/feed-post-list").then((m) => ({ default: m.FeedPostList })),
);
import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FeedComposerFormBody } from "@/components/community/feed-composer-form-body";
import { FeedComposerSheet } from "@/components/community/feed-composer-sheet";
import { useFeedComposer } from "@/hooks/use-feed-composer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  isCommunityTopicId,
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  readFeedComposerDraft,
  type CommunityTopicId,
  type FeedCursor,
} from "@/lib/community";
import { followUser, listFolloweeIdsForCurrentUser } from "@/lib/community";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { getProfilesByIds, searchProfilesByHandlePrefix, searchPublicProfilesForFeedQuery, useProfile } from "@/lib/profile";

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

const PAGE_SIZE = 20;

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
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleResults, setPeopleResults] = useState<
    Array<{ id: string; name: string; avatar_url: string | null; handle: string }>
  >([]);
  const [suggested, setSuggested] = useState<
    Array<{ id: string; name: string; avatar_url: string | null; handle: string }>
  >([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [followBusyIds, setFollowBusyIds] = useState<Record<string, boolean>>({});
  /** Current user’s followees — refreshed when Find people opens so search results show Following vs Follow. */
  const [followeeIds, setFolloweeIds] = useState<Set<string>>(() => new Set());
  const [followeesLoading, setFolloweesLoading] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [feedSearchExpanded, setFeedSearchExpanded] = useState(false);
  const [followingAuthorIds, setFollowingAuthorIds] = useState<string[] | null>(null);
  const [searchMatchedAuthorIds, setSearchMatchedAuthorIds] = useState<string[] | null>(null);

  const feedCacheScope = useMemo(
    () =>
      ["main", feedTab, topicFilter ?? "_", savedOnly ? "s" : "a", feedSearch.trim(), String(feedListKey)].join(":"),
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

  useEffect(() => {
    if (!peopleOpen) return;
    const t = window.setTimeout(() => {
      const q = peopleQuery.trim();
      if (!q) {
        setPeopleLoading(false);
        setPeopleError(null);
        setPeopleResults([]);
        return;
      }
      setPeopleLoading(true);
      setPeopleError(null);
      void searchProfilesByHandlePrefix(q, 10).then((res) => {
        setPeopleLoading(false);
        if (res.error) {
          setPeopleError(res.error.message);
          setPeopleResults([]);
          return;
        }
        const mapped = (res.data ?? [])
          .filter((p) => p.is_public === true)
          .map((p) => ({
            id: p.id,
            name: p.full_name?.trim() || shortId(p.id),
            avatar_url: p.avatar_url ?? null,
            handle: (p.public_handle ?? "").trim(),
          }))
          .filter((p) => Boolean(p.handle));
        setPeopleResults(mapped);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [peopleOpen, peopleQuery]);

  useEffect(() => {
    if (!peopleOpen) return;
    if (!user?.id) return;
    if (suggestedLoading || suggested.length > 0) return;
    setSuggestedLoading(true);
    void (async () => {
      const [pageRes, followingRes] = await Promise.all([
        fetchCommunityPostsPage(50, null),
        listFolloweeIdsForCurrentUser(),
      ]);
      if (pageRes.error || followingRes.error) {
        setSuggestedLoading(false);
        return;
      }
      const followeeSet = new Set(followingRes.ids);
      const ids: string[] = [];
      for (const p of pageRes.data ?? []) {
        const id = String(p.author_id);
        if (!id || id === user.id) continue;
        if (followeeSet.has(id)) continue;
        if (!ids.includes(id)) ids.push(id);
        if (ids.length >= 12) break;
      }
      if (ids.length === 0) {
        setSuggested([]);
        setSuggestedLoading(false);
        return;
      }
      const profiles = await getProfilesByIds(ids);
      const out = ids
        .map((id) => {
          const pr = profiles.get(id);
          const handle = (pr?.public_handle ?? "").trim();
          const isPublic = pr?.is_public !== false;
          if (!handle || !isPublic) return null;
          return {
            id,
            name: pr?.full_name?.trim() || shortId(id),
            avatar_url: pr?.avatar_url ?? null,
            handle,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .slice(0, 6);
      setSuggested(out);
      setSuggestedLoading(false);
    })();
  }, [peopleOpen, user?.id, suggestedLoading, suggested.length]);

  // Lightweight discovery: show suggested profiles on Following even before opening "Find people".
  useEffect(() => {
    if (!user?.id) return;
    if (feedTab !== "following") return;
    if (suggestedLoading || suggested.length > 0) return;
    // Avoid suggestions while user is actively searching or using Saved.
    if (savedOnly || feedSearch.trim()) return;

    setSuggestedLoading(true);
    void (async () => {
      const [pageRes, followingRes] = await Promise.all([
        fetchCommunityPostsPage(50, null),
        listFolloweeIdsForCurrentUser(),
      ]);
      if (pageRes.error || followingRes.error) {
        setSuggestedLoading(false);
        return;
      }
      const followeeSet = new Set(followingRes.ids);
      const ids: string[] = [];
      for (const p of pageRes.data ?? []) {
        const id = String(p.author_id);
        if (!id || id === user.id) continue;
        if (followeeSet.has(id)) continue;
        if (!ids.includes(id)) ids.push(id);
        if (ids.length >= 12) break;
      }
      if (ids.length === 0) {
        setSuggested([]);
        setSuggestedLoading(false);
        return;
      }
      const profiles = await getProfilesByIds(ids);
      const out = ids
        .map((id) => {
          const pr = profiles.get(id);
          const handle = (pr?.public_handle ?? "").trim();
          const isPublic = pr?.is_public !== false;
          if (!handle || !isPublic) return null;
          return {
            id,
            name: pr?.full_name?.trim() || shortId(id),
            avatar_url: pr?.avatar_url ?? null,
            handle,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .slice(0, 6);
      setSuggested(out);
      setSuggestedLoading(false);
    })();
  }, [user?.id, feedTab, savedOnly, feedSearch, suggestedLoading, suggested.length]);

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
        <PageHeader title="Feed" />
        <EmptyState
          title="Feed needs Supabase"
          description="Connect Supabase in your environment to use the community feed."
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="narrow" density="compact" className="pb-2">
      <PageHeader
        title="Feed"
        stackActionsMaxSm
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              type="button"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={() => setPeopleOpen(true)}
              data-testid="button-find-people"
              aria-label="Find people by @handle"
              title="Find people by @handle"
            >
              <SearchIcon className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl sm:hidden" asChild>
              <Link href="/community/messages" aria-label="Messages" title="Messages">
                <MessageCircle className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="hidden h-9 rounded-xl sm:inline-flex" asChild>
              <Link href="/community/messages" aria-label="Messages" title="Open messages">
                <MessageCircle className="h-4 w-4 mr-1.5" aria-hidden />
                <span>Messages</span>
              </Link>
            </Button>
          </div>
        }
      />

      {user && !profileLoading && !hasFeedHandle ? (
        <Alert className="rounded-2xl border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/25">
          <AlertDescription className="text-sm leading-relaxed text-foreground">
            <span className="font-medium">Set a @handle to post on the Feed.</span> You can still read posts. Your handle
            is used for @mentions and your public link.{" "}
            <Link href="/account#profile" className="font-medium text-primary underline-offset-4 hover:underline">
              Open Profile
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={peopleOpen} onOpenChange={setPeopleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Find people</DialogTitle>
            <DialogDescription>Search by handle (e.g. @ollie). We’ll suggest matches as you type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={peopleQuery}
              onChange={(e) => setPeopleQuery(e.target.value)}
              placeholder="Type a handle…"
              aria-label="Search people by handle"
              data-testid="input-find-people"
            />

            {peopleQuery.trim() ? (
              <>
                {peopleLoading ? <p className="text-sm text-muted-foreground">Searching…</p> : null}
                {peopleError ? <p className="text-sm text-destructive">{peopleError}</p> : null}
                {!peopleLoading && !peopleError && peopleResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matches.</p>
                ) : null}
                {peopleResults.length > 0 ? (
                  <ul className="space-y-2">
                    {peopleResults.map((p) => {
                      const isSelf = Boolean(user?.id && p.id === user.id);
                      const alreadyFollowing = Boolean(user?.id && followeeIds.has(p.id));
                      const busy = Boolean(followBusyIds[p.id]);
                      const waitFollowees = Boolean(user?.id && followeesLoading);
                      return (
                        <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3">
                          <CommunityAuthorAvatar
                            displayName={p.name}
                            avatarPath={p.avatar_url}
                            size="sm"
                            profileHref={`/community/profile/${encodeURIComponent(p.id)}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{p.handle}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={alreadyFollowing ? "secondary" : "outline"}
                            disabled={
                              !user ||
                              isSelf ||
                              busy ||
                              (waitFollowees && !alreadyFollowing) ||
                              alreadyFollowing
                            }
                            onClick={() => void handleFollow(p.id)}
                          >
                            {!user
                              ? "Follow"
                              : busy || (waitFollowees && !alreadyFollowing)
                                ? "…"
                                : alreadyFollowing
                                  ? "Following"
                                  : isSelf
                                    ? "You"
                                    : "Follow"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Suggested</p>
                  {suggestedLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
                </div>
                {suggested.length === 0 && !suggestedLoading ? (
                  <p className="text-sm text-muted-foreground">No suggestions yet.</p>
                ) : null}
                {suggested.length > 0 ? (
                  <ul className="space-y-2">
                    {suggested.map((p) => {
                      const isSelf = Boolean(user?.id && p.id === user.id);
                      const alreadyFollowing = Boolean(user?.id && followeeIds.has(p.id));
                      const busy = Boolean(followBusyIds[p.id]);
                      const waitFollowees = Boolean(user?.id && followeesLoading);
                      return (
                        <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3">
                          <CommunityAuthorAvatar
                            displayName={p.name}
                            avatarPath={p.avatar_url}
                            size="sm"
                            profileHref={`/community/profile/${encodeURIComponent(p.id)}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{p.handle}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={alreadyFollowing ? "secondary" : "outline"}
                            disabled={
                              !user ||
                              isSelf ||
                              busy ||
                              (waitFollowees && !alreadyFollowing) ||
                              alreadyFollowing
                            }
                            onClick={() => void handleFollow(p.id)}
                          >
                            {!user
                              ? "Follow"
                              : busy || (waitFollowees && !alreadyFollowing)
                                ? "…"
                                : alreadyFollowing
                                  ? "Following"
                                  : isSelf
                                    ? "You"
                                    : "Follow"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <FeedComposerSheet
        open={feedComposer.sheetOpen}
        onOpenChange={feedComposer.setSheetOpen}
        pillPreview={feedComposer.pillPreview}
        avatarDisplayName={feedComposer.avatarDisplayName}
        avatarPath={feedComposer.avatarPath}
        profileHref={feedComposer.profileHref}
        formBodyProps={feedComposer.formBodyProps}
        onSubmit={feedComposer.handlePost}
        showPill={isMobile}
        pillTestId="feed-composer-mobile-pill"
        formTestId="feed-composer-form-sheet"
      />

      <div
        className={cn(
          "space-y-2 rounded-2xl border border-border/45 bg-card/90 p-2 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/80",
          "sticky top-0 z-20 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        )}
      >
        <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="w-full">
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

      {feedTab === "following" && !savedOnly && !feedSearch.trim() && (suggestedLoading || suggested.length > 0) ? (
        <Card variant="glass" className="overflow-hidden" data-testid="card-feed-suggested-following">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Suggested people</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setPeopleOpen(true)}>
                Find more
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {suggestedLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {suggested.slice(0, 3).map((p) => {
                  const alreadyFollowing = Boolean(user?.id && followeeIds.has(p.id));
                  const busy = Boolean(followBusyIds[p.id]);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <CommunityAuthorAvatar
                          displayName={p.name}
                          avatarPath={p.avatar_url ?? null}
                          size="sm"
                          profileHref={`/community/profile/${encodeURIComponent(p.id)}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">@{p.handle}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={alreadyFollowing ? "secondary" : "outline"}
                        disabled={alreadyFollowing || busy}
                        onClick={() => void handleFollow(p.id)}
                      >
                        {alreadyFollowing ? "Following" : busy ? "Following…" : "Follow"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isMobile ? (
      <Collapsible open={composerPanelOpen} onOpenChange={setComposerPanelOpen}>
        <Card variant="glass" className={cn(!canComposeToFeed && user ? "opacity-90" : undefined)} data-testid="feed-composer-card">
          <CardHeader className="space-y-0 pb-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-xl text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-expanded={composerPanelOpen}
                data-testid="feed-composer-trigger"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <Plus
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden
                    strokeWidth={2.25}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="font-display text-base font-semibold text-foreground tracking-tight">New post</span>
                    {!composerPanelOpen && feedComposer.composer.trim() ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{feedComposer.composer}</p>
                    ) : null}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                    composerPanelOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent className="overflow-hidden">
            <CardContent className="pt-0">
              <form onSubmit={feedComposer.handlePost} className="space-y-3 text-foreground" data-testid="feed-composer-form">
                <FeedComposerFormBody {...feedComposer.formBodyProps} />
              </form>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      ) : null}

      <Suspense key={feedListKey} fallback={<FeedLoadingSkeleton rows={5} />}>
        <FeedPostList
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
      </Suspense>
    </PageShell>
  );
}
