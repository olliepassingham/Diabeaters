import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ChevronLeft, Send } from "lucide-react";
import { DmSharedPostPreview } from "@/components/community/dm-shared-post-preview";
import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDmMessages,
  fetchDmThreadsForCurrentUser,
  insertDmMessage,
  otherMemberUserId,
  parseSharedFeedPostMessage,
  type DmMessageRow,
  type ThreadWithMembers,
} from "@/lib/community";
import { getProfile } from "@/lib/profile";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    const res = await fetchDmMessages(threadId);
    if (res.error) {
      toast({ title: "Could not load messages", description: res.error.message, variant: "destructive" });
      setMessages([]);
    } else {
      setMessages(res.data ?? []);
    }
    setLoading(false);
  }, [threadId, toast]);

  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    void load();
  }, [threadId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!threadId || !user?.id) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchDmThreadsForCurrentUser();
      if (cancelled || res.error) return;
      const t = (res.data ?? []).find((x) => x.id === threadId) as ThreadWithMembers | undefined;
      if (!t) {
        setPeerLabel("Conversation");
        return;
      }
      const other = otherMemberUserId(t.members, user.id);
      if (!other) {
        setPeerLabel("Conversation");
        return;
      }
      const { profile } = await getProfile(other);
      if (cancelled) return;
      setPeerLabel(profile?.full_name?.trim() || shortId(other));
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, user?.id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!threadId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    const res = await insertDmMessage(threadId, trimmed);
    setSending(false);
    if (res.error) {
      toast({ title: "Send failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setBody("");
    if (res.data) setMessages((prev) => [...prev, res.data!]);
  }

  if (!match || !threadId) return null;

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
          title="Chat"
        />
        <p className="text-sm text-muted-foreground">Connect Supabase to use messages.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto flex flex-col min-h-[70vh] pb-24">
      <PageHeader
        leading={
          <Link href="/community/messages">
            <Button type="button" variant="ghost" size="icon" className="mr-2" aria-label="Back to messages">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
        title={peerLabel ?? "Chat"}
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
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    shared ? "" : "whitespace-pre-wrap"
                  } ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
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
                  ) : (
                    m.body
                  )}
                  <div className={`text-[10px] mt-1 opacity-80 ${mine ? "text-primary-foreground/80" : ""}`}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="sticky bottom-0 pt-2 pb-[env(safe-area-inset-bottom)] bg-background border-t border-border/60 mt-auto space-y-2">
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message…"
          maxLength={8000}
          disabled={sending || !user}
        />
        <Button type="submit" size="sm" disabled={sending || !body.trim() || !user}>
          <Send className="h-4 w-4 mr-1.5" />
          Send
        </Button>
      </form>
    </PageShell>
  );
}
