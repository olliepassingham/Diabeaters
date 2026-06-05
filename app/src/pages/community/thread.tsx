import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImagePlus, Send } from "lucide-react";
import { DmSharedPostPreview } from "@/components/community/dm-shared-post-preview";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  dmThreadQueryKey,
  fetchDmThreadBundle,
  markDmThreadReadWhenOpened,
} from "@/lib/dm-thread-query";
import {
  insertDmMessage,
  parseSharedFeedPostMessage,
  toggleDmMessageLike,
  type DmMessageRow,
} from "@/lib/community";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase";
import { format, isToday, isYesterday } from "date-fns";

function scrollToBottom(el: HTMLElement | null, behavior: ScrollBehavior) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior });
}

function dayDividerLabel(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM yyyy");
}

function DmMessageBubble({
  message: m,
  mine,
  onToggleLike,
}: {
  message: DmMessageRow;
  mine: boolean;
  onToggleLike: (m: DmMessageRow) => void;
}) {
  const shared = parseSharedFeedPostMessage(m.body);
  const likeCount = m.like_count ?? 0;
  const likedByMe = m.liked_by_me ?? false;
  const showImage = Boolean(m.image_signed_url);
  const hasText = !shared && Boolean(m.body.trim());

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(82%,17.5rem)] rounded-[1.15rem] px-3 py-2 text-[15px] leading-snug shadow-sm",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border/50 bg-card text-foreground",
          shared && "max-w-[min(92%,22rem)] p-2.5",
        )}
        onDoubleClick={!mine ? () => onToggleLike(m) : undefined}
        title={!mine ? "Double-tap to like" : undefined}
      >
        {shared ? (
          <>
            {shared.note ? <div className="mb-2 whitespace-pre-wrap px-0.5">{shared.note}</div> : null}
            <DmSharedPostPreview postId={shared.postId} />
          </>
        ) : null}
        {showImage ? (
          <div className={cn(shared && "mt-2")}>
            <img
              src={m.image_signed_url!}
              alt=""
              className="max-h-64 w-full rounded-xl object-cover bg-muted/30"
              loading="lazy"
            />
          </div>
        ) : null}
        {hasText ? <div className={cn("whitespace-pre-wrap", showImage && "mt-2")}>{m.body}</div> : null}
        {!shared && !showImage && m.image_storage_path && !m.image_signed_url ? (
          <span className="text-xs opacity-70">Could not load image</span>
        ) : null}
        <div
          className={cn(
            "mt-1.5 flex items-center gap-2 text-[10px]",
            mine ? "text-primary-foreground/75 justify-end" : "text-muted-foreground",
          )}
        >
          <time dateTime={m.created_at}>{format(new Date(m.created_at), "HH:mm")}</time>
          {!mine ? (
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                likedByMe ? "text-rose-500" : "hover:bg-muted/80",
              )}
              aria-label={likedByMe ? "Unlike" : "Like"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(m);
              }}
            >
              <Heart className={cn("h-3.5 w-3.5", likedByMe && "fill-current")} />
            </button>
          ) : null}
        </div>
        {likeCount > 0 ? (
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[10px]",
              mine ? "justify-end text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            <Heart className="h-3 w-3 fill-current text-rose-500" aria-hidden />
            <span>{likeCount}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CommunityThreadPage() {
  const [match, params] = useRoute("/community/messages/:threadId");
  const threadId = match && params?.threadId ? params.threadId : null;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didInitialScrollRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  const threadQuery = useQuery({
    queryKey: dmThreadQueryKey(threadId ?? undefined, userId),
    queryFn: () => fetchDmThreadBundle(threadId!, userId),
    enabled: Boolean(threadId && userId && isSupabaseConfigured()),
    staleTime: 20_000,
    gcTime: 10 * 60_000,
  });

  const messages = threadQuery.data?.messages ?? [];
  const loading = threadQuery.isPending && threadQuery.data === undefined;

  const setMessagesInCache = useCallback(
    (updater: (prev: DmMessageRow[]) => DmMessageRow[]) => {
      if (!threadId) return;
      queryClient.setQueryData(dmThreadQueryKey(threadId, userId), (old: typeof threadQuery.data) => {
        if (!old) return old;
        return { ...old, messages: updater(old.messages) };
      });
    },
    [queryClient, threadId, userId],
  );

  const markedReadRef = useRef<string | null>(null);
  useEffect(() => {
    markedReadRef.current = null;
  }, [threadId]);
  useEffect(() => {
    if (!threadId || !userId || loading) return;
    const hasIncomingUnread = messages.some((m) => m.sender_id !== userId && m.read_at == null);
    if (!hasIncomingUnread) return;
    const token = `${threadId}:${messages.length}:${messages[messages.length - 1]?.id ?? ""}`;
    if (markedReadRef.current === token) return;
    markedReadRef.current = token;
    void markDmThreadReadWhenOpened(threadId, userId, messages);
  }, [threadId, userId, loading, messages]);

  useLayoutEffect(() => {
    didInitialScrollRef.current = false;
    prevMessageCountRef.current = 0;
  }, [threadId]);

  useLayoutEffect(() => {
    if (loading || messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    if (!didInitialScrollRef.current) {
      scrollToBottom(el, "instant");
      didInitialScrollRef.current = true;
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessageCountRef.current) {
      const last = messages[messages.length - 1];
      const smooth = last?.sender_id === userId;
      scrollToBottom(el, smooth ? "smooth" : "instant");
    }
    prevMessageCountRef.current = messages.length;
  }, [loading, messages, userId]);

  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(() => composerRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [loading, threadId]);

  useEffect(() => {
    if (!pendingImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  const toggleLike = useCallback(
    async (m: DmMessageRow) => {
      if (!user || m.sender_id === user.id) return;
      const wasLiked = m.liked_by_me ?? false;
      const prevCount = m.like_count ?? 0;
      const optimisticLiked = !wasLiked;
      const optimisticCount = Math.max(0, wasLiked ? prevCount - 1 : prevCount + 1);
      setMessagesInCache((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, liked_by_me: optimisticLiked, like_count: optimisticCount } : x,
        ),
      );
      const res = await toggleDmMessageLike(m.id);
      if (res.error) {
        setMessagesInCache((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, liked_by_me: wasLiked, like_count: prevCount } : x)),
        );
        toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
      }
    },
    [toast, user, setMessagesInCache],
  );

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!threadId) return;
    const trimmed = body.trim();
    if (!trimmed && !pendingImage) return;
    setSending(true);
    const res = await insertDmMessage(threadId, trimmed, { imageFile: pendingImage });
    setSending(false);
    if (res.error) {
      toast({ title: "Send failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setBody("");
    setPendingImage(null);
    if (res.data) {
      setMessagesInCache((prev) => [...prev, res.data!]);
      requestAnimationFrame(() => scrollToBottom(scrollRef.current, "smooth"));
    }
  }

  if (!match || !threadId) return null;

  const shellClass =
    "mx-auto flex h-full min-h-0 w-full max-w-lg flex-col bg-background text-foreground";

  if (!isSupabaseConfigured()) {
    return (
      <div className={shellClass} data-testid="dm-thread-shell">
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">Connect Supabase to use messages.</p>
        </div>
      </div>
    );
  }

  if (threadQuery.error) {
    return (
      <div className={shellClass} data-testid="dm-thread-shell">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-destructive">{(threadQuery.error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => void threadQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  let lastDivider: string | null = null;

  return (
    <div className={shellClass} data-testid="dm-thread-shell">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-3"
        aria-label="Message history"
      >
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className={cn("h-14 rounded-2xl", i % 2 === 0 ? "w-[70%]" : "w-[55%]")} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Say hello.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => {
              const divider = dayDividerLabel(m.created_at);
              const showDivider = divider && divider !== lastDivider;
              if (showDivider) lastDivider = divider;
              const mine = userId === m.sender_id;
              return (
                <div key={m.id}>
                  {showDivider ? (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-muted/80 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {divider}
                      </span>
                    </div>
                  ) : null}
                  <DmMessageBubble message={m} mine={mine} onToggleLike={(msg) => void toggleLike(msg)} />
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      <form
        onSubmit={handleSend}
        className="z-10 shrink-0 border-t border-border/60 bg-background px-2 py-2 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)] pb-[calc(max(0.35rem,env(safe-area-inset-bottom,0px))+var(--keyboard-inset-bottom,0px))]"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPendingImage(f);
            e.target.value = "";
          }}
        />
        {previewUrl ? (
          <div className="mb-2 flex items-start gap-2">
            <img src={previewUrl} alt="" className="max-h-24 rounded-xl border border-border object-contain" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingImage(null)}>
              Remove
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground"
            disabled={sending || !user}
            aria-label="Attach photo"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Textarea
            ref={composerRef}
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message…"
            maxLength={8000}
            disabled={sending || !user}
            className="min-h-10 max-h-28 flex-1 resize-none rounded-2xl border-border/60 bg-muted/40 px-3 py-2 text-[16px] leading-snug"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && (body.trim() || pendingImage) && user) {
                  void handleSend(e as unknown as React.FormEvent);
                }
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            disabled={sending || (!body.trim() && !pendingImage) || !user}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
