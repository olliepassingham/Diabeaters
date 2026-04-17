import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  BarChart2,
  Calendar,
  ImagePlus,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FeedPostList } from "@/components/community/feed-post-list";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  COMMUNITY_TOPICS,
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
} from "@/lib/community";
import { followUser, listFolloweeIdsForCurrentUser } from "@/lib/community";
import { cn } from "@/lib/utils";
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
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { getProfilesByIds, searchProfilesByHandlePrefix } from "@/lib/profile";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type FeedTab = "everyone" | "following";

const PAGE_SIZE = 20;

const MAX_POLL_OPTIONS = 6;

type ComposerPostKind = "standard" | "poll" | "event";

export default function CommunityHomePage() {
  const { user } = useAuth();
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

  async function handleFollow(id: string) {
    if (!user?.id) {
      toast({ title: "Sign in to follow", variant: "destructive" });
      return;
    }
    setFollowBusyIds((prev) => ({ ...prev, [id]: true }));
    const res = await followUser(id);
    setFollowBusyIds((prev) => ({ ...prev, [id]: false }));
    if (res.error) {
      toast({ title: "Follow failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setSuggested((prev) => prev.filter((p) => p.id !== id));
    setPeopleResults((prev) => prev.filter((p) => p.id !== id));
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

  useEffect(() => {
    if (composerPostKind !== "standard") setComposerFiles([]);
  }, [composerPostKind]);

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

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !composerCanSubmit) return;
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
    toast({ title: "Posted" });
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="mx-auto max-w-lg space-y-6">
        <PageHeader leading={<PageBackButton />} title="Feed" />
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
      className="mx-auto max-w-lg space-y-6 pb-[calc(var(--bottom-nav-height,7.5rem)+2.5rem)]"
    >
      <PageHeader
        leading={<PageBackButton />}
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
              <Search className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account#community" aria-label="Feed profile settings">
                <Settings className="h-4 w-4" />
              </Link>
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
                    {peopleResults.map((p) => (
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
                          variant="outline"
                          disabled={Boolean(followBusyIds[p.id])}
                          onClick={() => void handleFollow(p.id)}
                        >
                          {followBusyIds[p.id] ? "…" : "Follow"}
                        </Button>
                      </li>
                    ))}
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
                    {suggested.map((p) => (
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
                          variant="outline"
                          disabled={Boolean(followBusyIds[p.id])}
                          onClick={() => void handleFollow(p.id)}
                        >
                          {followBusyIds[p.id] ? "…" : "Follow"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

        <div className="surface-glass-muted space-y-3 rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="w-full sm:max-w-md">
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1 dark:bg-muted/40">
                <TabsTrigger value="following" className="rounded-lg data-[state=active]:bg-card/95">
                  Following
                </TabsTrigger>
                <TabsTrigger value="everyone" className="rounded-lg data-[state=active]:bg-card/95">
                  Everyone
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto rounded-xl bg-background/40 px-2 py-2 dark:bg-background/25"
          role="group"
          aria-label="Filter feed by topic"
        >
          <Button
            type="button"
            variant={topicFilter === null ? "default" : "outline"}
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => setTopicFilter(null)}
          >
            All topics
          </Button>
          {COMMUNITY_TOPICS.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={topicFilter === t.id ? "default" : "outline"}
              size="sm"
              className="shrink-0 whitespace-nowrap rounded-full"
              onClick={() => setTopicFilter(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
            placeholder="Search loaded posts…"
            className="pl-9"
            aria-label="Search feed"
          />
        </div>
      </div>

      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base font-semibold">New post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePost} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="feed-topic" className="text-sm">
                Topic
              </Label>
              <Select
                value={composerTopic}
                onValueChange={(v) => setComposerTopic(v as CommunityTopicId)}
                disabled={submitting || !user}
              >
                <SelectTrigger id="feed-topic" className="w-full">
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_TOPICS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {composerPostKind === "poll" ? (
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="space-y-1">
                  <Label htmlFor="feed-poll-q">Poll question</Label>
                  <Input
                    id="feed-poll-q"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value.slice(0, 500))}
                    placeholder="What do you want to ask?"
                    disabled={submitting || !user}
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
                        disabled={submitting || !user}
                        maxLength={500}
                        aria-label={`Poll option ${i + 1}`}
                      />
                      {pollOptions.length > 2 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          disabled={submitting || !user}
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
                      disabled={submitting || !user}
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
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="space-y-1">
                  <Label htmlFor="feed-event-title">Event name</Label>
                  <Input
                    id="feed-event-title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value.slice(0, 500))}
                    placeholder="Meetup title"
                    disabled={submitting || !user}
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
                    disabled={submitting || !user}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feed-event-loc">Location (optional)</Label>
                  <Input
                    id="feed-event-loc"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value.slice(0, 500))}
                    placeholder="Where?"
                    disabled={submitting || !user}
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
                    disabled={submitting || !user}
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
              disabled={submitting || !user}
              className="surface-field min-h-[5.5rem] rounded-xl"
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">{composer.length} / 8000</p>
            {composerPostKind === "standard" && composerPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {composerPreviews.map((src, i) => (
                  <div key={src} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                      onClick={() => removeComposerImage(i)}
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {composerPostKind === "standard" && composerPreviews.length > 0 ? (
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
                      disabled={submitting || !user}
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
                disabled={
                  submitting ||
                  !user ||
                  composerFiles.length >= MAX_POST_IMAGES ||
                  composerPostKind !== "standard"
                }
                onChange={(e) => onPickImages(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  submitting ||
                  !user ||
                  composerFiles.length >= MAX_POST_IMAGES ||
                  composerPostKind !== "standard"
                }
                onClick={() => fileInputRef.current?.click()}
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
              <InlineInfoHint
                ariaLabel="Photo limits for posts"
                content={`Up to ${MAX_POST_IMAGES} photos per post, 5MB each.`}
              />
              <Button type="submit" size="sm" className="ml-auto" disabled={submitting || !composerCanSubmit}>
                <Send className="h-4 w-4 mr-1.5" />
                Post
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <FeedPostList
        key={feedListKey}
        viewerId={user?.id}
        searchQuery={feedSearch}
        pageSize={PAGE_SIZE}
        showRefreshButton
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
        fetchPage={(limit, cursor) =>
          feedTab === "everyone"
            ? fetchCommunityPostsPage(limit, cursor, topicFilter)
            : fetchCommunityPostsFromFollowingPage(limit, cursor, topicFilter)
        }
      />
    </PageShell>
  );
}
