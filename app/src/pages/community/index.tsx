import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Drawer } from "vaul";
import { Capacitor } from "@capacitor/core";
import { Camera, type GalleryPhoto } from "@capacitor/camera";
import {
  BarChart2,
  Bookmark,
  Calendar,
  ChevronDown,
  ImagePlus,
  MessageCircle,
  Plus,
  Search as SearchIcon,
  Send,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FeedPostList } from "@/components/community/feed-post-list";
import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_COMMUNITY_TOPIC,
  isCommunityTopicId,
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  insertFeedPost,
  buildMentionsForPost,
  FEED_COMPOSER_DRAFT_KEY,
  MAX_POST_IMAGES,
  readFeedComposerDraft,
  type CommunityPostRow,
  type CommunityTopicId,
  type FeedCursor,
} from "@/lib/community";
import type { CommunityTopicRow } from "@/lib/community/topics";
import { followUser, listFolloweeIdsForCurrentUser } from "@/lib/community";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { getProfilesByIds, searchProfilesByHandlePrefix, searchPublicProfilesForFeedQuery, useProfile } from "@/lib/profile";
import { useCommunityTopicOrder } from "@/hooks/use-community-topic-order";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type FeedTab = "everyone" | "following";

const PAGE_SIZE = 20;

const MAX_POLL_OPTIONS = 6;

type ComposerPostKind = "standard" | "poll" | "event";

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

type FeedComposerFormBodyProps = {
  orderedTopics: readonly CommunityTopicRow[];
  composerTopic: CommunityTopicId;
  setComposerTopic: (v: CommunityTopicId) => void;
  submitting: boolean;
  user: { id: string } | null;
  canComposeToFeed: boolean;
  composerPostKind: ComposerPostKind;
  pollQuestion: string;
  setPollQuestion: (v: string) => void;
  pollOptions: string[];
  setPollOptions: Dispatch<SetStateAction<string[]>>;
  eventTitle: string;
  setEventTitle: (v: string) => void;
  eventStartsAt: string;
  setEventStartsAt: (v: string) => void;
  eventLocation: string;
  setEventLocation: (v: string) => void;
  eventDetails: string;
  setEventDetails: (v: string) => void;
  composer: string;
  setComposer: (v: string) => void;
  composerPreviews: string[];
  composerFiles: File[];
  removeComposerImage: (index: number) => void;
  composerImageAlts: string[];
  setComposerImageAlts: Dispatch<SetStateAction<string[]>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickImages: (files: FileList | null) => void;
  pickImagesFromLibraryOnly: () => Promise<void>;
  onPollModeClick: () => void;
  onEventModeClick: () => void;
  composerCanSubmit: boolean;
};

function FeedComposerFormBody({
  orderedTopics,
  composerTopic,
  setComposerTopic,
  submitting,
  user,
  canComposeToFeed,
  composerPostKind,
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
  eventTitle,
  setEventTitle,
  eventStartsAt,
  setEventStartsAt,
  eventLocation,
  setEventLocation,
  eventDetails,
  setEventDetails,
  composer,
  setComposer,
  composerPreviews,
  composerFiles,
  removeComposerImage,
  composerImageAlts,
  setComposerImageAlts,
  fileInputRef,
  onPickImages,
  pickImagesFromLibraryOnly,
  onPollModeClick,
  onEventModeClick,
  composerCanSubmit,
}: FeedComposerFormBodyProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="feed-topic" className="text-sm font-medium text-foreground">
          Topic
        </Label>
        <Select
          value={composerTopic}
          onValueChange={(v) => setComposerTopic(v as CommunityTopicId)}
          disabled={submitting || !user || !canComposeToFeed}
        >
          <SelectTrigger
            id="feed-topic"
            className="h-11 w-full border-border/60 bg-muted/25 text-foreground dark:bg-muted/30 dark:text-foreground [&>span]:text-foreground"
          >
            <SelectValue placeholder="Choose a topic" />
          </SelectTrigger>
          <SelectContent>
            {orderedTopics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {composerPostKind === "poll" ? (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3 text-foreground">
          <div className="space-y-1">
            <Label htmlFor="feed-poll-q">Poll question</Label>
            <Input
              id="feed-poll-q"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value.slice(0, 500))}
              placeholder="What do you want to ask?"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
            />
          </div>
          <p className="text-xs text-muted-foreground">2–6 options, each up to 500 characters.</p>
          <div className="space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) =>
                    setPollOptions((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value.slice(0, 500);
                      return next;
                    })
                  }
                  placeholder={`Option ${i + 1}`}
                  disabled={submitting || !user || !canComposeToFeed}
                  maxLength={500}
                  aria-label={`Poll option ${i + 1}`}
                />
                {pollOptions.length > 2 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={submitting || !user || !canComposeToFeed}
                    onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || !user || !canComposeToFeed}
                onClick={() => setPollOptions((prev) => [...prev, ""])}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add option
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {composerPostKind === "event" ? (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3 text-foreground">
          <div className="space-y-1">
            <Label htmlFor="feed-event-title">Event name</Label>
            <Input
              id="feed-event-title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value.slice(0, 500))}
              placeholder="Meetup title"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-event-start">Starts</Label>
            <Input
              id="feed-event-start"
              type="datetime-local"
              value={eventStartsAt}
              onChange={(e) => setEventStartsAt(e.target.value)}
              disabled={submitting || !user || !canComposeToFeed}
              className="text-foreground dark:[color-scheme:dark]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-event-loc">Location (optional)</Label>
            <Input
              id="feed-event-loc"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value.slice(0, 500))}
              placeholder="Where?"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-event-details">Details (optional)</Label>
            <Textarea
              id="feed-event-details"
              value={eventDetails}
              onChange={(e) => setEventDetails(e.target.value.slice(0, 2000))}
              placeholder="More about the event…"
              rows={3}
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={2000}
              className="surface-field rounded-xl"
            />
          </div>
        </div>
      ) : null}
      <Textarea
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        placeholder={
          composerPostKind === "poll"
            ? "Optional intro before the poll…"
            : composerPostKind === "event"
              ? "Optional intro before the event details…"
              : "Share something on the feed…"
        }
        rows={3}
        maxLength={8000}
        disabled={submitting || !user || !canComposeToFeed}
        className="surface-field min-h-[5.5rem] rounded-xl"
      />
      <p className="text-right text-xs text-muted-foreground tabular-nums">{composer.length} / 8000</p>
      {composerPreviews.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 p-3 sm:p-3.5">
          <p className="text-xs font-medium text-muted-foreground">
            Attached photos
            <span className="ml-1.5 tabular-nums text-foreground/80">({composerPreviews.length})</span>
          </p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:thin]">
            {composerPreviews.map((src, i) => {
              const name = composerFiles[i]?.name?.trim() || `Photo ${i + 1}`;
              return (
                <div key={`${src}-${i}`} className="relative w-[5.5rem] shrink-0 sm:w-24">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeComposerImage(i)}
                      aria-label={`Remove ${name}`}
                      disabled={submitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p
                    className="mt-1.5 truncate text-center text-[10px] leading-tight text-muted-foreground sm:text-xs"
                    title={name}
                  >
                    {name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {composerPreviews.length > 0 ? (
        <div className="space-y-2">
          {composerPreviews.map((src, i) => (
            <div key={src} className="space-y-1">
              <Label htmlFor={`feed-composer-alt-${i}`} className="text-xs">
                Photo {i + 1} description (optional)
              </Label>
              <Input
                id={`feed-composer-alt-${i}`}
                value={composerImageAlts[i] ?? ""}
                onChange={(e) =>
                  setComposerImageAlts((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value.slice(0, 500);
                    return next;
                  })
                }
                placeholder="What’s in this image? Helps people using screen readers."
                disabled={submitting || !user || !canComposeToFeed}
                maxLength={500}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="feed-composer-images"
          disabled={submitting || !user || !canComposeToFeed || composerFiles.length >= MAX_POST_IMAGES}
          onChange={(e) => onPickImages(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting || !user || !canComposeToFeed || composerFiles.length >= MAX_POST_IMAGES}
          onClick={() => void pickImagesFromLibraryOnly()}
          aria-label="Add photos to post"
        >
          <ImagePlus className="h-4 w-4 mr-1.5" />
          Photo
        </Button>
        <Button
          type="button"
          variant={composerPostKind === "poll" ? "default" : "outline"}
          size="sm"
          disabled={submitting || !user}
          onClick={onPollModeClick}
          aria-pressed={composerPostKind === "poll"}
          aria-label={composerPostKind === "poll" ? "Switch to normal post" : "Add poll"}
        >
          <BarChart2 className="h-4 w-4 mr-1.5" />
          Poll
        </Button>
        <Button
          type="button"
          variant={composerPostKind === "event" ? "default" : "outline"}
          size="sm"
          disabled={submitting || !user}
          onClick={onEventModeClick}
          aria-pressed={composerPostKind === "event"}
          aria-label={composerPostKind === "event" ? "Switch to normal post" : "Add event"}
        >
          <Calendar className="h-4 w-4 mr-1.5" />
          Event
        </Button>
        <InlineInfoHint ariaLabel="Photo limits for posts" content={`Up to ${MAX_POST_IMAGES} photos per post, 5MB each.`} />
        <Button type="submit" size="sm" className="ml-auto" disabled={submitting || !composerCanSubmit || !canComposeToFeed}>
          <Send className="h-4 w-4 mr-1.5" />
          Post
        </Button>
      </div>
    </>
  );
}

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const orderedTopics = useCommunityTopicOrder();
  const { toast } = useToast();
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
  /** `null` = all topics. */
  const [topicFilter, setTopicFilter] = useState<CommunityTopicId | null>(null);
  const [composerTopic, setComposerTopic] = useState<CommunityTopicId>(
    () => readFeedComposerDraft()?.topic ?? DEFAULT_COMMUNITY_TOPIC,
  );
  const [feedSearch, setFeedSearch] = useState("");

  const [composer, setComposer] = useState(() => readFeedComposerDraft()?.body ?? "");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [composerImageAlts, setComposerImageAlts] = useState<string[]>([]);
  const [composerPreviews, setComposerPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [composerPostKind, setComposerPostKind] = useState<ComposerPostKind>("standard");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedListKey, setFeedListKey] = useState(0);
  const [composerPanelOpen, setComposerPanelOpen] = useState(initialFeedComposerOpen);

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
  const isMobile = useIsMobile();
  const [composerSheetOpen, setComposerSheetOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(readFeedComposerDraft()?.body?.trim());
    } catch {
      return false;
    }
  });
  const [savedOnly, setSavedOnly] = useState(false);
  const [feedSearchExpanded, setFeedSearchExpanded] = useState(false);
  const [followingAuthorIds, setFollowingAuthorIds] = useState<string[] | null>(null);
  const [searchMatchedAuthorIds, setSearchMatchedAuthorIds] = useState<string[] | null>(null);

  const hasFeedHandle = Boolean(profile?.public_handle?.trim());
  const canComposeToFeed = Boolean(user?.id) && !profileLoading && hasFeedHandle;

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
    setComposer(qDraft.trim());
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
    const urls = composerFiles.map((f) => URL.createObjectURL(f));
    setComposerPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [composerFiles]);

  useEffect(() => {
    setComposerImageAlts((prev) => {
      const n = composerFiles.length;
      if (prev.length === n) return prev;
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  }, [composerFiles.length]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (!composer.trim()) {
          localStorage.removeItem(FEED_COMPOSER_DRAFT_KEY);
          return;
        }
        localStorage.setItem(
          FEED_COMPOSER_DRAFT_KEY,
          JSON.stringify({
            body: composer,
            topic: composerTopic,
          }),
        );
      } catch {
        /* quota / private mode */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [composer, composerTopic]);

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const next: File[] = [...composerFiles];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f) continue;
      if (next.length >= MAX_POST_IMAGES) break;
      if (!f.type.startsWith("image/")) continue;
      next.push(f);
    }
    setComposerFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function pickImagesFromLibraryOnly() {
    // On native (Capacitor), use Photos-only picker to avoid "Take Photo" (camera) which is crashing.
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const remaining = Math.max(0, MAX_POST_IMAGES - composerFiles.length);
      if (remaining <= 0) return;

      const res = await Camera.pickImages({ limit: remaining });
      const photos: GalleryPhoto[] = res?.photos ?? [];
      if (photos.length === 0) return;

      const newFiles: File[] = [];
      for (const p of photos) {
        const webPath = p.webPath?.trim();
        if (!webPath) continue;
        const r = await fetch(webPath);
        const blob = await r.blob();
        if (!blob.type.startsWith("image/")) continue;
        const name = p.path?.split("/").pop()?.trim() || `photo-${Date.now()}.jpg`;
        newFiles.push(new File([blob], name, { type: blob.type }));
        if (composerFiles.length + newFiles.length >= MAX_POST_IMAGES) break;
      }
      if (newFiles.length > 0) setComposerFiles((prev) => [...prev, ...newFiles].slice(0, MAX_POST_IMAGES));
    } catch (e) {
      // If the plugin isn't available (web) or permission denied, fall back to file input.
      fileInputRef.current?.click();
      toast({
        title: "Could not open Photos",
        description: e instanceof Error ? e.message : "Try selecting from your camera roll.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeComposerImage(index: number) {
    setComposerFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function resetComposerAfterPost() {
    setComposer("");
    setComposerFiles([]);
    setComposerImageAlts([]);
    setComposerPostKind("standard");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setEventTitle("");
    setEventStartsAt("");
    setEventLocation("");
    setEventDetails("");
    try {
      localStorage.removeItem(FEED_COMPOSER_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  function onPollModeClick() {
    if (composerPostKind === "poll") {
      setComposerPostKind("standard");
      return;
    }
    setEventTitle("");
    setEventStartsAt("");
    setEventLocation("");
    setEventDetails("");
    setComposerPostKind("poll");
  }

  function onEventModeClick() {
    if (composerPostKind === "event") {
      setComposerPostKind("standard");
      return;
    }
    setPollQuestion("");
    setPollOptions(["", ""]);
    setComposerPostKind("event");
  }

  const composerCanSubmit = useMemo(() => {
    if (!user) return false;
    if (composerPostKind === "standard") {
      const t = composer.trim();
      return Boolean(t || composerFiles.length > 0);
    }
    if (composerPostKind === "poll") {
      const q = pollQuestion.trim();
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      return q.length > 0 && opts.length >= 2 && opts.length <= MAX_POLL_OPTIONS;
    }
    const titleOk = eventTitle.trim().length > 0;
    const whenOk = eventStartsAt.trim().length > 0;
    return titleOk && whenOk;
  }, [user, composerPostKind, composer, composerFiles.length, pollQuestion, pollOptions, eventTitle, eventStartsAt]);

  const composerExpandSignal = useMemo(() => {
    if (composer.trim()) return true;
    if (composerFiles.length > 0) return true;
    if (composerPostKind !== "standard") return true;
    return false;
  }, [composer, composerFiles.length, composerPostKind]);

  useEffect(() => {
    if (!composerExpandSignal) return;
    if (isMobile) setComposerSheetOpen(true);
    else setComposerPanelOpen(true);
  }, [composerExpandSignal, isMobile]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !composerCanSubmit) return;
    if (!canComposeToFeed) {
      toast({
        title: "Choose a @handle to post",
        description: "Set your public handle in Feed profile settings — it powers mentions and your profile link.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);

    const mentions = await buildMentionsForPost(composer, user.id);

    let res: { data: CommunityPostRow | null; error: Error | null };
    if (composerPostKind === "standard") {
      res = await insertFeedPost({
        kind: "standard",
        topic: composerTopic,
        body: composer,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    } else if (composerPostKind === "poll") {
      res = await insertFeedPost({
        kind: "poll",
        topic: composerTopic,
        body: composer,
        question: pollQuestion,
        options: pollOptions,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    } else {
      const startDate = new Date(eventStartsAt);
      if (Number.isNaN(startDate.getTime())) {
        setSubmitting(false);
        toast({ title: "Invalid date", description: "Choose a valid start date and time.", variant: "destructive" });
        return;
      }
      const iso = startDate.toISOString();
      res = await insertFeedPost({
        kind: "event",
        topic: composerTopic,
        body: composer,
        title: eventTitle,
        startsAt: iso,
        location: eventLocation.trim() || undefined,
        details: eventDetails.trim() || undefined,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    }

    setSubmitting(false);
    if (res.error) {
      toast({ title: "Post failed", description: res.error.message, variant: "destructive" });
      return;
    }
    resetComposerAfterPost();
    if (res.data) setFeedListKey((k) => k + 1);
    if (isMobile) setComposerSheetOpen(false);
    toast({ title: "Posted" });
  }

  const feedComposerFormBodyProps: FeedComposerFormBodyProps = {
    orderedTopics,
    composerTopic,
    setComposerTopic,
    submitting,
    user,
    canComposeToFeed,
    composerPostKind,
    pollQuestion,
    setPollQuestion,
    pollOptions,
    setPollOptions,
    eventTitle,
    setEventTitle,
    eventStartsAt,
    setEventStartsAt,
    eventLocation,
    setEventLocation,
    eventDetails,
    setEventDetails,
    composer,
    setComposer,
    composerPreviews,
    composerFiles,
    removeComposerImage,
    composerImageAlts,
    setComposerImageAlts,
    fileInputRef,
    onPickImages,
    pickImagesFromLibraryOnly,
    onPollModeClick,
    onEventModeClick,
    composerCanSubmit,
  };

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
    <PageShell
      variant="standard"
      className="mx-auto max-w-lg space-y-6 pb-4"
    >
      <PageHeader
        title="Feed"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setPeopleOpen(true)}
              data-testid="button-find-people"
              aria-label="Find people"
              title="Find people"
            >
              <SearchIcon className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/community/messages">
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Messages
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

      {isMobile ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-3 py-3 text-left shadow-sm ring-1 ring-border/40 backdrop-blur-sm dark:bg-card/50 min-h-[3rem]"
          onClick={() => setComposerSheetOpen(true)}
          data-testid="feed-composer-mobile-pill"
        >
          <CommunityAuthorAvatar
            displayName={(profile?.full_name ?? user?.email ?? "You").trim() || "You"}
            avatarPath={profile?.avatar_url ?? null}
            size="sm"
            profileHref={user?.id ? `/community/profile/${encodeURIComponent(user.id)}` : undefined}
          />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {composer.trim() ? composer.trim() : "Share something on the feed…"}
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          "space-y-2 rounded-2xl border border-border/50 bg-background/85 p-2 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70",
          "sticky top-0 z-20 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        )}
      >
        <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="w-full sm:max-w-md">
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-muted/60 p-1 dark:bg-muted/40">
            <TabsTrigger value="following" className="rounded-lg text-sm data-[state=active]:bg-card/95">
              Following
            </TabsTrigger>
            <TabsTrigger value="everyone" className="rounded-lg text-sm data-[state=active]:bg-card/95">
              Everyone
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          role="tablist"
          aria-label="Feed topics"
          className="flex gap-2 overflow-x-auto rounded-xl bg-muted/25 px-1 py-1.5 dark:bg-muted/15 [scrollbar-width:thin]"
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
              className="shrink-0 whitespace-nowrap rounded-full"
              onClick={() => {
                setTopicFilter(t.id);
                setSavedOnly(false);
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {isMobile && !feedSearchExpanded ? (
          <div className="flex items-center justify-end gap-2">
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
              aria-label="Open search"
              onClick={() => setFeedSearchExpanded(true)}
            >
              <SearchIcon className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              placeholder="Search posts and people"
              className="pl-9 pr-20"
              aria-label="Search feed"
            />
            {isMobile && feedSearchExpanded ? (
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
            ) : null}
          </div>
        )}

        {!isMobile ? (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant={savedOnly ? "secondary" : "outline"}
              size="sm"
              className="rounded-full"
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
                    {!composerPanelOpen && composer.trim() ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{composer}</p>
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
              <form onSubmit={handlePost} className="space-y-3 text-foreground" data-testid="feed-composer-form">
                <FeedComposerFormBody {...feedComposerFormBodyProps} />
              </form>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      ) : null}

      {isMobile ? (
        <Drawer.Root
          open={composerSheetOpen}
          onOpenChange={setComposerSheetOpen}
          handleOnly
          shouldScaleBackground={false}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-[110] bg-black/80" />
            <Drawer.Content
              className={cn(
                "fixed inset-x-0 bottom-0 z-[110] flex h-[min(92dvh,calc(100dvh-0.5rem))] max-h-[100dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border/60 bg-background p-0 pt-2 text-foreground shadow-2xl outline-none",
              )}
            >
              <div className="flex shrink-0 flex-col items-center px-4 pb-2 pt-1">
                <Drawer.Handle
                  className="!h-1 !w-12 shrink-0 !rounded-full !bg-muted-foreground/40"
                  aria-label="Drag down to close"
                />
              </div>
              <div className="relative shrink-0 space-y-1 px-4 pb-2 text-left">
                <Drawer.Close className="absolute right-1 top-0 rounded-sm p-2 text-foreground opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <X className="h-5 w-5" aria-hidden />
                  <span className="sr-only">Close</span>
                </Drawer.Close>
                <Drawer.Title className="font-display pr-11 text-lg tracking-tight text-foreground">
                  New post
                </Drawer.Title>
                <Drawer.Description className="text-sm text-muted-foreground">
                  Share with the community. Add photos, a poll, or an event.
                </Drawer.Description>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
                <form
                  onSubmit={handlePost}
                  className="space-y-3 pb-2 text-foreground"
                  data-testid="feed-composer-form-sheet"
                  id="feed-composer-form-sheet"
                >
                  <FeedComposerFormBody {...feedComposerFormBodyProps} />
                </form>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : null}

      <FeedPostList
        key={feedListKey}
        viewerId={user?.id}
        searchQuery={feedSearch}
        pageSize={PAGE_SIZE}
        topicsForSelect={orderedTopics}
        showRefreshButton
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
    </PageShell>
  );
}
