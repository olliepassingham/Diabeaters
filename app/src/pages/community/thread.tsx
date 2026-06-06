import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImagePlus, Check, CheckCheck, Send } from "lucide-react";
import { DmSharedPostPreview } from "@/components/community/dm-shared-post-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import {
  formatReadReceiptTime,
  latestReadOutgoingMessageId,
  readReceiptStatusForMessage,
  type DmReadReceiptStatus,
} from "@/lib/dm-read-receipts";
import { useDmThreadLive } from "@/lib/dm-thread-live";
import { usePeerTypingActive } from "@/lib/dm-thread-typing";
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

function DmMessageImage({
  src,
  className,
  overlayTime,
  mine,
  readReceiptStatus,
}: {
  src: string;
  className?: string;
  overlayTime?: string;
  mine?: boolean;
  readReceiptStatus?: DmReadReceiptStatus | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(
          "group relative block w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label="View full size photo"
        data-testid="dm-message-image-open"
      >
        <img src={src} alt="" className="max-h-72 w-full object-cover bg-muted/20" loading="lazy" />
        {overlayTime ? (
          <span
            className={cn(
              "absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur-md",
              mine ? "bg-black/35 text-white" : "bg-background/70 text-foreground/80",
            )}
          >
            {overlayTime}
            {mine && readReceiptStatus ? <ReadReceiptIcon status={readReceiptStatus} /> : null}
          </span>
        ) : null}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(96vw,48rem)] overflow-hidden border-0 bg-transparent p-0 shadow-none">
          <img
            src={src}
            alt=""
            className="block h-auto max-h-[85vh] w-full rounded-lg bg-black/95 object-contain"
            data-testid="dm-message-image-full"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DmTypingDots() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/80"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
      Typing…
    </div>
  );
}

function ReadReceiptIcon({ status }: { status: DmReadReceiptStatus }) {
  if (status === "read") {
    return <CheckCheck className="h-3 w-3 shrink-0 opacity-90" aria-label="Read" />;
  }
  return <Check className="h-3 w-3 shrink-0 opacity-70" aria-label="Sent" />;
}

function messagesGrouped(messages: DmMessageRow[]): boolean[] {
  return messages.map((m, i) => {
    if (i === 0) return false;
    const prev = messages[i - 1]!;
    if (prev.sender_id !== m.sender_id) return false;
    const t1 = new Date(prev.created_at).getTime();
    const t2 = new Date(m.created_at).getTime();
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) return false;
    return t2 - t1 < 5 * 60 * 1000;
  });
}

function DmMessageBubble({
  message: m,
  mine,
  groupedWithPrevious,
  readReceiptStatus,
  showReadLabel,
  onToggleLike,
}: {
  message: DmMessageRow;
  mine: boolean;
  groupedWithPrevious: boolean;
  readReceiptStatus: DmReadReceiptStatus | null;
  showReadLabel: boolean;
  onToggleLike: (m: DmMessageRow) => void;
}) {
  const shared = parseSharedFeedPostMessage(m.body);
  const likeCount = m.like_count ?? 0;
  const likedByMe = m.liked_by_me ?? false;
  const showImage = Boolean(m.image_signed_url);
  const hasText = !shared && Boolean(m.body.trim());
  const isImageOnly = showImage && !hasText && !shared;
  const timeLabel = format(new Date(m.created_at), "HH:mm");

  const bubbleShell = cn(
    "relative max-w-[min(88%,20rem)] text-[15px] leading-relaxed",
    isImageOnly
      ? "overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 dark:ring-white/10"
      : cn(
          "px-3.5 py-2 shadow-sm",
          groupedWithPrevious ? "mt-0.5" : "",
          mine
            ? cn(
                "rounded-[1.25rem] bg-primary text-primary-foreground",
                groupedWithPrevious ? "rounded-tr-[0.45rem]" : "rounded-br-[0.45rem]",
              )
            : cn(
                "rounded-[1.25rem] bg-card text-foreground ring-1 ring-border/40",
                groupedWithPrevious ? "rounded-tl-[0.45rem]" : "rounded-bl-[0.45rem]",
              ),
          shared && "max-w-[min(92%,22rem)] p-2.5",
        ),
  );

  return (
    <div
      className={cn(
        "group/msg flex w-full items-end gap-1.5",
        mine ? "justify-end" : "justify-start",
        groupedWithPrevious ? "mt-0.5" : "mt-2",
      )}
    >
      {!mine ? (
        <button
          type="button"
          className={cn(
            "mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all",
            likedByMe ? "text-rose-500 opacity-100" : "opacity-45 hover:bg-muted/80 hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-70",
          )}
          aria-label={likedByMe ? "Unlike" : "Like"}
          onClick={() => onToggleLike(m)}
        >
          <Heart className={cn("h-4 w-4", likedByMe && "fill-current")} />
        </button>
      ) : null}

      <div
        className={cn("min-w-0", bubbleShell)}
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
          <div className={cn(!isImageOnly && (shared || hasText) && "mt-2", isImageOnly && "p-0")}>
            <DmMessageImage
              src={m.image_signed_url!}
              className={isImageOnly ? "rounded-none" : "rounded-xl"}
              overlayTime={isImageOnly ? timeLabel : undefined}
              mine={mine}
              readReceiptStatus={isImageOnly ? readReceiptStatus : null}
            />
          </div>
        ) : null}

        {hasText ? <div className={cn("whitespace-pre-wrap", showImage && "mt-2")}>{m.body}</div> : null}

        {!shared && !showImage && m.image_storage_path && !m.image_signed_url ? (
          <span className="text-xs opacity-70">Could not load image</span>
        ) : null}

        {!isImageOnly ? (
          <div
            className={cn(
              "mt-1 flex items-center gap-1.5 text-[10px] tabular-nums",
              mine ? "justify-end text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            <time dateTime={m.created_at}>{timeLabel}</time>
            {mine && readReceiptStatus ? <ReadReceiptIcon status={readReceiptStatus} /> : null}
          </div>
        ) : null}

        {mine && showReadLabel && m.read_at ? (
          <p className="mt-0.5 text-right text-[10px] text-primary-foreground/60">
            Read {formatReadReceiptTime(m.read_at) ?? ""}
          </p>
        ) : null}

        {likeCount > 0 ? (
          <div
            className={cn(
              "absolute -bottom-2 flex items-center gap-0.5 rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px] shadow-sm",
              mine ? "-left-1" : "-right-1",
            )}
          >
            <Heart className="h-3 w-3 fill-rose-500 text-rose-500" aria-hidden />
            <span className="font-medium tabular-nums text-foreground">{likeCount}</span>
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
  const messagingBlocked = threadQuery.data?.messagingBlocked ?? false;
  const loading = threadQuery.isPending && threadQuery.data === undefined;

  const { notifyComposerTyping } = useDmThreadLive(threadId, userId, queryClient);
  const peerTyping = usePeerTypingActive(threadId);
  const latestReadOutgoingId = latestReadOutgoingMessageId(messages, userId);

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
    notifyComposerTyping(false);
    if (res.data) {
      setMessagesInCache((prev) => [...prev, res.data!]);
      requestAnimationFrame(() => scrollToBottom(scrollRef.current, "smooth"));
    }
  }

  if (!match || !threadId) return null;

  const shellClass =
    "mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col bg-background text-foreground";

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
  const groupedFlags = messagesGrouped(messages);

  return (
    <div className={shellClass} data-testid="dm-thread-shell">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-gradient-to-b from-muted/25 via-background to-background px-3 py-4 sm:px-4"
        aria-label="Message history"
      >
        {loading ? (
          <div className="space-y-3 px-1" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start pl-9" : "justify-end")}>
                <Skeleton className={cn("h-12 rounded-2xl", i % 2 === 0 ? "w-[68%]" : "w-[52%]")} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Say hello to start the conversation.</p>
          </div>
        ) : (
          <div className="flex flex-col pb-2">
            {messages.map((m, index) => {
              const divider = dayDividerLabel(m.created_at);
              const showDivider = divider && divider !== lastDivider;
              if (showDivider) lastDivider = divider;
              const mine = userId === m.sender_id;
              return (
                <div key={m.id}>
                  {showDivider ? (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground shadow-sm backdrop-blur-sm">
                        {divider}
                      </span>
                    </div>
                  ) : null}
                  <DmMessageBubble
                    message={m}
                    mine={mine}
                    groupedWithPrevious={groupedFlags[index] ?? false}
                    readReceiptStatus={readReceiptStatusForMessage(m, userId)}
                    showReadLabel={mine && m.id === latestReadOutgoingId}
                    onToggleLike={(msg) => void toggleLike(msg)}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} className="h-2 shrink-0" aria-hidden />
      </div>

      {peerTyping ? <DmTypingDots /> : null}

      <form
        onSubmit={handleSend}
        className="z-10 shrink-0 border-t border-border/50 bg-background/90 px-3 py-2.5 backdrop-blur-xl pb-[calc(max(0.5rem,env(safe-area-inset-bottom,0px))+var(--keyboard-inset-bottom,0px))]"
      >
        {messagingBlocked ? (
          <p className="mb-2 px-1 text-center text-sm text-muted-foreground" data-testid="dm-thread-blocked-notice">
            Messaging is unavailable because one of you has blocked the other.
          </p>
        ) : null}
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
          <div className="mb-2.5 flex items-start gap-2 rounded-2xl border border-border/50 bg-muted/30 p-2">
            <img src={previewUrl} alt="" className="max-h-28 rounded-xl object-cover shadow-sm" />
            <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-xl" onClick={() => setPendingImage(null)}>
              Remove
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-[1.75rem] border border-border/50 bg-muted/35 p-1.5 pl-2 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            disabled={sending || !user || messagingBlocked}
            aria-label="Attach photo"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
          </Button>
          <Textarea
            ref={composerRef}
            rows={1}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              notifyComposerTyping(Boolean(e.target.value.trim()));
            }}
            placeholder={messagingBlocked ? "Messaging unavailable" : "Message…"}
            maxLength={8000}
            disabled={sending || !user || messagingBlocked}
            className="min-h-10 max-h-28 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-[16px] leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && !messagingBlocked && (body.trim() || pendingImage) && user) {
                  void handleSend(e as unknown as React.FormEvent);
                }
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className={cn(
              "h-10 w-10 shrink-0 rounded-full transition-all",
              body.trim() || pendingImage ? "shadow-md" : "opacity-50",
            )}
            disabled={sending || messagingBlocked || (!body.trim() && !pendingImage) || !user}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
