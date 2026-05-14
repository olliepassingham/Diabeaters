import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ChevronLeft, Heart, ImagePlus, Send } from "lucide-react";
import { DmSharedPostPreview } from "@/components/community/dm-shared-post-preview";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDmMessages,
  fetchDmThreadMembers,
  insertDmMessage,
  otherMemberUserId,
  parseSharedFeedPostMessage,
  toggleDmMessageLike,
  type DmMessageRow,
} from "@/lib/community";
import { getProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export default function CommunityThreadPage() {
  const [match, params] = useRoute("/community/messages/:threadId");
  const threadId = match && params?.threadId ? params.threadId : null;
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [peerLabel, setPeerLabel] = useState<string | null>(null);
  const [peerAvatarPath, setPeerAvatarPath] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setPeerLabel(null);
    setPeerAvatarPath(null);
    setPeerUserId(null);

    const [msgRes, memRes] = await Promise.all([
      fetchDmMessages(threadId),
      user?.id ? fetchDmThreadMembers(threadId) : Promise.resolve({ data: [], error: null }),
    ]);

    if (msgRes.error) {
      toast({ title: "Could not load messages", description: msgRes.error.message, variant: "destructive" });
      setMessages([]);
    } else {
      setMessages(msgRes.data ?? []);
    }

    if (!user?.id) {
      setPeerLabel(null);
    } else if (memRes.error || !memRes.data?.length) {
      setPeerLabel("Conversation");
    } else {
      const other = otherMemberUserId(memRes.data, user.id);
      if (!other) {
        setPeerLabel("Conversation");
      } else {
        const { profile } = await getProfile(other);
        const name = profile?.full_name?.trim() || shortId(other);
        setPeerLabel(name);
        setPeerAvatarPath(profile?.avatar_url ?? null);
        setPeerUserId(other);
      }
    }

    setLoading(false);
  }, [threadId, toast, user?.id]);

  useEffect(() => {
    if (!threadId) return;
    void load();
  }, [threadId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, liked_by_me: optimisticLiked, like_count: optimisticCount } : x,
        ),
      );
      const res = await toggleDmMessageLike(m.id);
      if (res.error) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, liked_by_me: wasLiked, like_count: prevCount } : x)),
        );
        toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
      }
    },
    [toast, user],
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
    if (res.data) setMessages((prev) => [...prev, res.data!]);
  }

  if (!match || !threadId) return null;

  const headerTitle =
    peerUserId && peerLabel && peerLabel !== "Conversation" ? (
      <span className="flex min-w-0 items-center gap-2.5">
        <CommunityAuthorAvatar
          size="sm"
          displayName={peerLabel}
          avatarPath={peerAvatarPath}
          profileHref={`/community/profile/${encodeURIComponent(peerUserId)}`}
        />
        <span className="truncate">{peerLabel}</span>
      </span>
    ) : (
      (peerLabel ?? "Chat")
    );

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader
          leading={
            <Link href="/community/messages">
              <Button type="button" variant="ghost" size="icon" className="mr-2" aria-label="Back to messages">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
          }
          title={headerTitle}
        />
        <p className="text-sm text-muted-foreground">Connect Supabase to use messages.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="standard"
      className="max-w-lg mx-auto flex min-h-[70vh] flex-col pb-4"
    >
      <PageHeader
        leading={
          <Link href="/community/messages">
            <Button type="button" variant="ghost" size="icon" className="mr-2" aria-label="Back to messages">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
        title={headerTitle}
      />

      <div className="flex-1 overflow-y-auto space-y-3 py-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = user?.id === m.sender_id;
            const shared = parseSharedFeedPostMessage(m.body);
            const likeCount = m.like_count ?? 0;
            const likedByMe = m.liked_by_me ?? false;
            const showImage = Boolean(m.image_signed_url);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    shared ? "" : "whitespace-pre-wrap",
                    mine ? "bg-primary text-primary-foreground" : "bg-muted",
                    !mine && "cursor-default select-none",
                  )}
                  onDoubleClick={!mine ? () => void toggleLike(m) : undefined}
                  title={!mine ? "Double-click to like" : undefined}
                >
                  {shared ? (
                    <>
                      {shared.note ? (
                        <div className="whitespace-pre-wrap">{shared.note}</div>
                      ) : null}
                      <div className={shared.note ? "mt-2" : ""}>
                        <DmSharedPostPreview postId={shared.postId} />
                      </div>
                    </>
                  ) : null}
                  {showImage ? (
                    <div className={shared ? "mt-2" : ""}>
                      <img
                        src={m.image_signed_url!}
                        alt=""
                        className="max-w-full max-h-72 rounded-lg object-contain bg-black/5"
                      />
                    </div>
                  ) : null}
                  {!shared && m.body.trim() ? (
                    <div className={showImage ? "mt-2 whitespace-pre-wrap" : ""}>{m.body}</div>
                  ) : null}
                  {!shared && !showImage && m.image_storage_path && !m.image_signed_url ? (
                    <span className="text-xs opacity-80">Could not load image</span>
                  ) : null}
                  <div
                    className={cn(
                      "flex items-center gap-2 mt-1 text-[10px] opacity-80",
                      mine ? "text-primary-foreground/80" : "",
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </span>
                    {!mine ? (
                      <button
                        type="button"
                        className={cn(
                          "shrink-0 rounded-md p-2 -mr-1 min-h-11 min-w-11 inline-flex items-center justify-center hover:opacity-100 opacity-70 transition-opacity",
                          likedByMe && "opacity-100",
                        )}
                        aria-label={likedByMe ? "Unlike message" : "Like message"}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleLike(m);
                        }}
                      >
                        <Heart className={cn("h-3.5 w-3.5", likedByMe && "fill-current")} />
                      </button>
                    ) : null}
                  </div>
                  {likeCount > 0 ? (
                    <div
                      className={cn(
                        "text-[10px] mt-0.5 flex items-center gap-0.5 opacity-80",
                        mine ? "text-primary-foreground/80 justify-end" : "",
                      )}
                    >
                      <Heart className="h-3 w-3 fill-current" aria-hidden />
                      <span>{likeCount}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-[var(--bottom-nav-height,0px)] pt-2 pb-[env(safe-area-inset-bottom)] bg-background border-t border-border/60 mt-auto space-y-2"
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
        <div className="flex gap-2 items-end">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={sending || !user}
            aria-label="Attach photo"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message…"
            maxLength={8000}
            disabled={sending || !user}
            className="min-h-[2.75rem] flex-1"
          />
        </div>
        {previewUrl ? (
          <div className="flex items-start gap-2">
            <img src={previewUrl} alt="" className="max-h-28 rounded-lg border border-border object-contain" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingImage(null)}>
              Remove
            </Button>
          </div>
        ) : null}
        <Button type="submit" size="sm" disabled={sending || (!body.trim() && !pendingImage) || !user}>
          <Send className="h-4 w-4 mr-1.5" />
          Send
        </Button>
      </form>
    </PageShell>
  );
}
