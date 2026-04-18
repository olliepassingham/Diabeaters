import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, MessageCircle } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDmThreadsForCurrentUser,
  fetchLatestDmMessageForThreads,
  getOrCreateDmThread,
  otherMemberUserId,
  type DmMessageRow,
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

export default function CommunityMessagesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [threads, setThreads] = useState<ThreadWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [handleInput, setHandleInput] = useState("");
  const [starting, setStarting] = useState(false);
  /** Other user id -> display name (until profile batch loads) */
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [lastByThreadId, setLastByThreadId] = useState<Record<string, DmMessageRow | null>>({});
  const [avatarByUserId, setAvatarByUserId] = useState<Record<string, string | null>>({});
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; name: string; avatar_url: string | null; handle: string }>
  >([]);

  const refresh = useCallback(async () => {
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
      setLoading(false);
      return;
    }

    const list = res.data ?? [];
    setThreads(list);

    if (list.length === 0) {
      setLastByThreadId({});
      setAvatarByUserId({});
      setLoading(false);
      return;
    }

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

    const [lastRes, profileMap] = await Promise.all([
      fetchLatestDmMessageForThreads(threadIds),
      otherIds.length > 0 ? getProfilesByIds(otherIds) : Promise.resolve(new Map()),
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
    for (const id of otherIds) {
      const p = profileMap.get(id);
      av[id] = p?.avatar_url ?? null;
      lbl[id] = p?.full_name?.trim() || shortId(id);
    }
    setAvatarByUserId(av);
    setLabels(lbl);

    setLoading(false);
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
      className="max-w-lg mx-auto space-y-4 pb-[calc(var(--bottom-nav-height,7.5rem)+2.5rem)]"
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
        <CardContent className="pt-6 space-y-3">
          <form onSubmit={handleStartChat} className="space-y-2">
            <FieldLabelWithInfo
              htmlFor="community-handle"
              info="Enter the person's public @handle from their feed profile. They must have saved a handle in Feed profile settings."
            >
              Public handle
            </FieldLabelWithInfo>
            <Input
              id="community-handle"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              placeholder="e.g. olliepass or @olliepass"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              disabled={starting || !user}
              aria-autocomplete="list"
              aria-controls="messages-handle-suggestions"
            />
            {handleInput.trim() ? (
              <div id="messages-handle-suggestions" className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-2">
                {suggestLoading ? <p className="text-sm text-muted-foreground px-1">Searching…</p> : null}
                {suggestError ? <p className="text-sm text-destructive px-1">{suggestError}</p> : null}
                {!suggestLoading && !suggestError && suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1">No matching handles. Check spelling or try another prefix.</p>
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
            <Button type="submit" size="sm" disabled={starting || !handleInput.trim() || !user}>
              Open or start chat
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No conversations yet.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => {
            const other = user?.id ? otherMemberUserId(t.members, user.id) : null;
            const label = other ? labels[other] ?? shortId(other) : "Chat";
            const last = lastByThreadId[t.id] ?? null;
            const preview = last ? lastMessagePreview(last) : "No messages yet";
            const { label: timeStr, title: timeTitle } = timeLabelForThread(last, t);
            const avatarPath = other ? avatarByUserId[other] : null;

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
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        <p className="text-sm text-muted-foreground truncate">{preview}</p>
                      </div>
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
