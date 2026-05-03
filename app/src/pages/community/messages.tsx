import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { BellOff, ChevronRight, EyeOff, MessageCircle, MoreHorizontal, Pin, Search } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  fetchDmThreadsForCurrentUser,
  fetchDmThreadUserSettings,
  fetchLatestDmMessageForThreads,
  getOrCreateDmThread,
  otherMemberUserId,
  type DmMessageRow,
  upsertDmThreadUserSettings,
  type ThreadWithMembers,
} from "@/lib/community";
import {
  getProfileIdByPublicHandle,
  getProfilesByIds,
  normalizePublicHandleInput,
  searchProfilesByHandlePrefix,
} from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function firstLinePreview(body: string): string {
  const line = body.split(/\r?\n/)[0]?.trim() ?? "";
  return line || "Message";
}

function lastMessagePreview(last: DmMessageRow): string {
  const hasImg = Boolean(last.image_storage_path?.trim());
  const text = last.body.trim();
  if (hasImg && !text) return "Photo";
  if (hasImg && text) {
    const line = firstLinePreview(last.body);
    return line === "Message" ? "Photo" : `${line} · Photo`;
  }
  return firstLinePreview(last.body);
}

function timeLabelForThread(last: DmMessageRow | null, thread: ThreadWithMembers): { label: string; title: string } {
  const iso = last?.created_at ?? thread.updated_at;
  const d = new Date(iso);
  const title = Number.isNaN(d.getTime()) ? iso : d.toISOString();
  if (Number.isNaN(d.getTime())) return { label: "", title };
  return {
    label: formatDistanceToNow(d, { addSuffix: true }),
    title,
  };
}

function threadSortKeyMs(last: DmMessageRow | null, thread: ThreadWithMembers): number {
  const iso = last?.created_at ?? thread.updated_at ?? thread.created_at;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

const DM_PINS_KEY = "diabeater_dm_pins_v1";
const DM_MUTES_KEY = "diabeater_dm_mutes_v1";
const DM_HIDDEN_KEY = "diabeater_dm_hidden_v1";

function readPinnedThreadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DM_PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function readThreadIdList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function writePinnedThreadIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DM_PINS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function writeThreadIdList(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export default function CommunityMessagesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [threads, setThreads] = useState<ThreadWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  /** After thread rows render, last-message previews + avatars still loading. */
  const [threadDetailsLoading, setThreadDetailsLoading] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [starting, setStarting] = useState(false);
  /** Other user id -> display name (until profile batch loads) */
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [lastByThreadId, setLastByThreadId] = useState<Record<string, DmMessageRow | null>>({});
  const [avatarByUserId, setAvatarByUserId] = useState<Record<string, string | null>>({});
  const [handleByUserId, setHandleByUserId] = useState<Record<string, string>>({});
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; name: string; avatar_url: string | null; handle: string }>
  >([]);
  const [threadQuery, setThreadQuery] = useState("");
  const handleInputRef = useRef<HTMLInputElement>(null);
  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>(() => readPinnedThreadIds());
  const [mutedThreadIds, setMutedThreadIds] = useState<string[]>(() => readThreadIdList(DM_MUTES_KEY));
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>(() => readThreadIdList(DM_HIDDEN_KEY));
  const [showHidden, setShowHidden] = useState(false);
  const [serverMutedByThreadId, setServerMutedByThreadId] = useState<Record<string, boolean>>({});
  const [serverHiddenByThreadId, setServerHiddenByThreadId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPinnedThreadIds(readPinnedThreadIds());
    setMutedThreadIds(readThreadIdList(DM_MUTES_KEY));
    setHiddenThreadIds(readThreadIdList(DM_HIDDEN_KEY));
  }, []);

  const pinnedSet = useMemo(() => new Set(pinnedThreadIds), [pinnedThreadIds]);
  const mutedSet = useMemo(() => {
    // Always include local values so mute works even if server RPC isn't deployed yet.
    const out = new Set<string>(mutedThreadIds);
    for (const [tid, v] of Object.entries(serverMutedByThreadId)) {
      if (v) out.add(tid);
    }
    return out;
  }, [mutedThreadIds, serverMutedByThreadId]);
  const hiddenSet = useMemo(() => {
    // Always include local values so hide works even if server RPC isn't deployed yet.
    const out = new Set<string>(hiddenThreadIds);
    for (const [tid, v] of Object.entries(serverHiddenByThreadId)) {
      if (v) out.add(tid);
    }
    return out;
  }, [hiddenThreadIds, serverHiddenByThreadId]);

  const sortedThreads = useCallback(() => {
    const list = [...threads];
    list.sort((a, b) => {
      const ap = pinnedSet.has(a.id) ? 1 : 0;
      const bp = pinnedSet.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const la = lastByThreadId[a.id] ?? null;
      const lb = lastByThreadId[b.id] ?? null;
      return threadSortKeyMs(lb, b) - threadSortKeyMs(la, a);
    });
    return list;
  }, [threads, lastByThreadId, pinnedSet]);

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    const base = sortedThreads().filter((t) => (showHidden ? true : !hiddenSet.has(t.id)));
    if (!q) return base;
    return base.filter((t) => {
      const last = lastByThreadId[t.id] ?? null;
      const other = user?.id ? otherMemberUserId(t.members, user.id) : null;
      const name = other ? (labels[other] ?? shortId(other)) : "Chat";
      const handle = other ? (handleByUserId[other] ?? "") : "";
      const preview = last ? lastMessagePreview(last) : "No messages yet";
      return (
        name.toLowerCase().includes(q) ||
        handle.toLowerCase().replace(/^@/, "").includes(q.replace(/^@/, "")) ||
        preview.toLowerCase().includes(q)
      );
    });
  }, [threadQuery, sortedThreads, lastByThreadId, user?.id, labels, handleByUserId, hiddenSet, showHidden]);

  const togglePinned = useCallback((threadId: string) => {
    setPinnedThreadIds((prev) => {
      const next = prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [threadId, ...prev];
      writePinnedThreadIds(next);
      return next;
    });
  }, []);

  const toggleMuted = useCallback((threadId: string) => {
    setMutedThreadIds((prev) => {
      const next = prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [threadId, ...prev];
      writeThreadIdList(DM_MUTES_KEY, next);
      return next;
    });
  }, []);

  const hideThread = useCallback(
    (threadId: string) => {
      setHiddenThreadIds((prev) => {
        if (prev.includes(threadId)) return prev;
        const next = [threadId, ...prev];
        writeThreadIdList(DM_HIDDEN_KEY, next);
        return next;
      });
      toast({
        title: "Conversation hidden",
        description: "You can show hidden conversations using the toggle above.",
      });
    },
    [toast],
  );

  const unhideThreadLocal = useCallback((threadId: string) => {
    setHiddenThreadIds((prev) => {
      const next = prev.filter((id) => id !== threadId);
      writeThreadIdList(DM_HIDDEN_KEY, next);
      return next;
    });
  }, []);

  const toggleMutedServerFirst = useCallback(
    async (threadId: string) => {
      if (!isSupabaseConfigured()) {
        toggleMuted(threadId);
        return;
      }
      const current = Boolean(serverMutedByThreadId[threadId]);
      const next = !current;
      const res = await upsertDmThreadUserSettings(threadId, { muted: next });
      if (res.error) {
        // If the DB function hasn't been deployed yet (or PostgREST schema cache hasn't refreshed),
        // fall back to local-only behaviour without a scary toast.
        if (res.error.message.toLowerCase().includes("could not find the function")) {
          toggleMuted(threadId);
          if (import.meta.env.DEV) {
            console.warn("[dm] upsert_dm_thread_user_settings missing; using local mute.");
          }
          return;
        }
        toggleMuted(threadId);
        toast({ title: "Could not update mute", description: res.error.message, variant: "destructive" });
        return;
      }
      setServerMutedByThreadId((m) => ({ ...m, [threadId]: next }));
    },
    [serverMutedByThreadId, toast, toggleMuted],
  );

  const hideThreadServerFirst = useCallback(
    async (threadId: string) => {
      if (!isSupabaseConfigured()) {
        hideThread(threadId);
        return;
      }
      const res = await upsertDmThreadUserSettings(threadId, { hidden: true });
      if (res.error) {
        if (res.error.message.toLowerCase().includes("could not find the function")) {
          hideThread(threadId);
          if (import.meta.env.DEV) {
            console.warn("[dm] upsert_dm_thread_user_settings missing; using local hide.");
          }
          return;
        }
        hideThread(threadId);
        toast({ title: "Could not hide conversation", description: res.error.message, variant: "destructive" });
        return;
      }
      setServerHiddenByThreadId((m) => ({ ...m, [threadId]: true }));
      toast({
        title: "Conversation hidden",
        description: "You can show hidden conversations using the toggle above.",
      });
    },
    [toast, hideThread],
  );

  const unhideThreadServerFirst = useCallback(
    async (threadId: string) => {
      // Always update local immediately so the UI responds even if server isn't ready.
      unhideThreadLocal(threadId);
      setServerHiddenByThreadId((m) => ({ ...m, [threadId]: false }));

      if (!isSupabaseConfigured()) return;
      const res = await upsertDmThreadUserSettings(threadId, { hidden: false });
      if (res.error) {
        if (res.error.message.toLowerCase().includes("could not find the function")) {
          if (import.meta.env.DEV) {
            console.warn("[dm] upsert_dm_thread_user_settings missing; using local unhide.");
          }
          return;
        }
        toast({ title: "Could not unhide conversation", description: res.error.message, variant: "destructive" });
      }
    },
    [toast, unhideThreadLocal],
  );

  const refresh = useCallback(async () => {
    setThreadDetailsLoading(false);
    setLoading(true);
    const res = await fetchDmThreadsForCurrentUser();
    if (res.error) {
      toast({
        title: "Could not load messages",
        description: res.error.message,
        variant: "destructive",
      });
      setThreads([]);
      setLastByThreadId({});
      setAvatarByUserId({});
      setHandleByUserId({});
      setLoading(false);
      return;
    }

    const list = res.data ?? [];
    setThreads(list);

    if (list.length === 0) {
      setLastByThreadId({});
      setAvatarByUserId({});
      setHandleByUserId({});
      setLoading(false);
      return;
    }

    // Show conversation rows immediately; fill previews + avatars in a follow-up (faster first paint).
    setLoading(false);
    setThreadDetailsLoading(true);

    const threadIds = list.map((t) => t.id);
    const otherIds = user?.id
      ? [
          ...new Set(
            list
              .map((t) => otherMemberUserId(t.members, user.id))
              .filter((id): id is string => Boolean(id)),
          ),
        ]
      : [];

    try {
      const [lastRes, profileMap, settingsRes] = await Promise.all([
        fetchLatestDmMessageForThreads(threadIds),
        otherIds.length > 0 ? getProfilesByIds(otherIds) : Promise.resolve(new Map()),
        isSupabaseConfigured() ? fetchDmThreadUserSettings(threadIds) : Promise.resolve({ data: new Map(), error: null }),
      ]);

      if (lastRes.error) {
        toast({
          title: "Could not load last messages",
          description: lastRes.error.message,
          variant: "destructive",
        });
      }

      const lastRecord: Record<string, DmMessageRow | null> = {};
      for (const [tid, row] of lastRes.data) {
        lastRecord[tid] = row;
      }
      setLastByThreadId(lastRecord);

      const av: Record<string, string | null> = {};
      const lbl: Record<string, string> = {};
      const hdl: Record<string, string> = {};
      for (const id of otherIds) {
        const p = profileMap.get(id);
        av[id] = p?.avatar_url ?? null;
        lbl[id] = p?.full_name?.trim() || shortId(id);
        hdl[id] = (p?.public_handle ?? "").trim();
      }
      setAvatarByUserId(av);
      setLabels(lbl);
      setHandleByUserId(hdl);

      if (settingsRes?.data) {
        const muted: Record<string, boolean> = {};
        const hidden: Record<string, boolean> = {};
        for (const [tid, row] of settingsRes.data.entries()) {
          muted[tid] = Boolean(row.muted);
          hidden[tid] = Boolean(row.hidden);
        }
        setServerMutedByThreadId(muted);
        setServerHiddenByThreadId(hidden);
      }
    } finally {
      setThreadDetailsLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const raw = handleInput.trim().replace(/^@/, "");
    if (!raw) {
      setSuggestLoading(false);
      setSuggestError(null);
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSuggestLoading(true);
      setSuggestError(null);
      void searchProfilesByHandlePrefix(raw, 10).then((res) => {
        setSuggestLoading(false);
        if (res.error) {
          setSuggestError(res.error.message);
          setSuggestions([]);
          return;
        }
        const mapped = (res.data ?? [])
          .filter((p) => p.is_public === true)
          .filter((p) => p.id !== user?.id)
          .map((p) => ({
            id: p.id,
            name: p.full_name?.trim() || shortId(p.id),
            avatar_url: p.avatar_url ?? null,
            handle: (p.public_handle ?? "").trim(),
          }))
          .filter((p) => Boolean(p.handle));
        setSuggestions(mapped);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [handleInput, user?.id]);

  // Single search box: same input drives both people suggestions and conversation filtering.
  useEffect(() => {
    setThreadQuery(handleInput);
  }, [handleInput]);

  async function navigateToDmThread(targetUserId: string): Promise<boolean> {
    const res = await getOrCreateDmThread(targetUserId);
    if (res.error) {
      toast({ title: "Could not open chat", description: res.error.message, variant: "destructive" });
      return false;
    }
    if (res.data) {
      setLocation(`/community/messages/${res.data}`);
    }
    return true;
  }

  async function openChatWithUserId(targetUserId: string) {
    if (!user?.id) {
      toast({ title: "Sign in to message", variant: "destructive" });
      return;
    }
    if (targetUserId === user.id) {
      toast({ title: "Choose someone else", variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
      await navigateToDmThread(targetUserId);
    } finally {
      setStarting(false);
    }
  }

  async function handleStartChat(e: React.FormEvent) {
    e.preventDefault();
    const raw = handleInput.trim().replace(/^@/, "");
    if (!raw) {
      toast({
        title: "Enter a handle",
        description: "Use their public handle (e.g. olliepass).",
        variant: "destructive",
      });
      return;
    }

    let normalized: string;
    try {
      const n = normalizePublicHandleInput(raw);
      if (!n) {
        toast({
          title: "Enter a handle",
          description: "Use their public handle (e.g. olliepass).",
          variant: "destructive",
        });
        return;
      }
      normalized = n;
    } catch (err) {
      toast({
        title: "Invalid handle",
        description: err instanceof Error ? err.message : "Use 3–30 letters, numbers, or underscores.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({ title: "Sign in to message", variant: "destructive" });
      return;
    }

    setStarting(true);
    try {
      const { userId, error: lookupError } = await getProfileIdByPublicHandle(normalized);
      if (lookupError) {
        toast({ title: "Could not look up handle", description: lookupError.message, variant: "destructive" });
        return;
      }
      if (!userId) {
        toast({
          title: "No user found",
          description: `No one is using @${normalized} yet. They need to set a community handle in settings.`,
          variant: "destructive",
        });
        return;
      }
      if (userId === user.id) {
        toast({ title: "Choose someone else", variant: "destructive" });
        return;
      }
      await navigateToDmThread(userId);
    } finally {
      setStarting(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Messages" />
        <p className="text-sm text-muted-foreground">Connect Supabase to use messages.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="standard"
      className="max-w-lg mx-auto space-y-4 pb-4"
    >
      <PageHeader
        leading={<PageBackButton />}
        title="Messages"
        description="Direct messages (1:1)."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/community">
              <MessageCircle className="h-4 w-4 mr-1.5" />
              Feed
            </Link>
          </Button>
        }
      />

      <Card className="pressable card-interactive">
        <CardContent className="pt-4 space-y-2">
          <FieldLabelWithInfo
            htmlFor="messages-search"
            info="Search your conversations and start new chats by @handle."
          >
            Search
          </FieldLabelWithInfo>
          <form onSubmit={handleStartChat} className="space-y-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="messages-search"
                ref={handleInputRef}
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="Search or enter @handle"
                className="pl-9 h-10 text-sm"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                disabled={starting || !user}
                aria-autocomplete="list"
                aria-controls="messages-handle-suggestions"
              />
            </div>

            {handleInput.trim() ? (
              <div
                id="messages-handle-suggestions"
                className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-2"
              >
                {suggestLoading ? <p className="text-sm text-muted-foreground px-1">Searching…</p> : null}
                {suggestError ? <p className="text-sm text-destructive px-1">{suggestError}</p> : null}
                {!suggestLoading && !suggestError && suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1">
                    No matching handles. Keep typing to filter conversations.
                  </p>
                ) : null}
                {suggestions.length > 0 ? (
                  <ul className="space-y-1.5">
                    {suggestions.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/70 px-2 py-2"
                      >
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
                          disabled={starting || !user}
                          onClick={() => void openChatWithUserId(p.id)}
                        >
                          Chat
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {hiddenSet.size > 0 ? (
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground min-h-9 px-1"
                  onClick={() => setShowHidden((v) => !v)}
                >
                  {showHidden ? "Hide hidden conversations" : "Show hidden conversations"}
                </button>
                {showHidden ? <span className="text-xs text-muted-foreground">{hiddenSet.size} hidden</span> : null}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading conversations">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[4.25rem] w-full rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          description="Start a chat from a public @handle (above), or head to the Feed to find people."
        >
          <Button variant="secondary" size="sm" asChild>
            <Link href="/community">Go to Feed</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleInputRef.current?.focus()}
          >
            Start a chat
          </Button>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {filteredThreads.map((t) => {
            const other = user?.id ? otherMemberUserId(t.members, user.id) : null;
            const label = other ? labels[other] ?? shortId(other) : "Chat";
            const last = lastByThreadId[t.id] ?? null;
            const preview = last ? lastMessagePreview(last) : "No messages yet";
            const { label: timeStr, title: timeTitle } = timeLabelForThread(last, t);
            const avatarPath = other ? avatarByUserId[other] : null;
            const isUnread =
              Boolean(user?.id) && Boolean(last) && last!.sender_id !== user!.id && last!.read_at == null;
            const isPinned = pinnedSet.has(t.id);
            const isMuted = mutedSet.has(t.id);
            const isHidden = hiddenSet.has(t.id);

            return (
              <li key={t.id}>
                <Link href={`/community/messages/${t.id}`} className="block">
                  <Card className="pressable card-interactive transition-colors hover:bg-muted/30">
                    <CardContent className="flex items-center gap-3 py-3">
                      {other ? (
                        <CommunityAuthorAvatar
                          displayName={label}
                          avatarPath={avatarPath}
                          profileHref={`/community/profile/${other}`}
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-full bg-muted" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-medium text-foreground truncate">
                          {label}
                          {isPinned ? <Pin className="ml-2 inline-block h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
                          {isMuted ? <BellOff className="ml-2 inline-block h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
                          {showHidden && isHidden ? <EyeOff className="ml-2 inline-block h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
                          {isUnread ? (
                            <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary align-middle" aria-label="Unread" />
                          ) : null}
                        </p>
                        <p className={`text-sm truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                          {threadDetailsLoading ? (
                            <Skeleton className="mt-0.5 h-4 w-[min(14rem,72%)] rounded-md" aria-hidden />
                          ) : (
                            preview
                          )}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-muted-foreground"
                            aria-label="Conversation actions"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              togglePinned(t.id);
                            }}
                          >
                            <Pin className="h-4 w-4" aria-hidden />
                            {isPinned ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              void toggleMutedServerFirst(t.id);
                            }}
                          >
                            <BellOff className="h-4 w-4" aria-hidden />
                            {isMuted ? "Unmute" : "Mute"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              if (isHidden) {
                                void unhideThreadServerFirst(t.id);
                              } else {
                                void hideThreadServerFirst(t.id);
                              }
                            }}
                          >
                            <EyeOff className="h-4 w-4" aria-hidden />
                            {isHidden ? "Unhide" : "Hide"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {timeStr ? (
                        <time
                          dateTime={last?.created_at ?? t.updated_at}
                          title={timeTitle}
                          className="shrink-0 self-start pt-0.5 text-xs text-muted-foreground tabular-nums"
                        >
                          {timeStr}
                        </time>
                      ) : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
