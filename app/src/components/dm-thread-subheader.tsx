import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { dmThreadQueryKey, fetchDmThreadBundle } from "@/lib/dm-thread-query";
import { usePeerTypingActive } from "@/lib/dm-thread-typing";
import { isSupabaseConfigured } from "@/lib/supabase";

function backFromDmThread(setLocation: (to: string, opts?: { replace?: boolean }) => void): void {
  // Use browser history so profile → thread returns to profile, inbox → thread returns to inbox.
  // A hard Link to /community/messages stacked a duplicate inbox entry and broke Messages back.
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
    return;
  }
  setLocation("/community/messages", { replace: true });
}

/**
 * Conversation chrome below AppTopBar: back to inbox + peer name/avatar.
 */
export function DmThreadSubheader() {
  const [match, params] = useRoute("/community/messages/:threadId");
  const threadId = match && params?.threadId ? params.threadId : null;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [, setLocation] = useLocation();

  const threadQuery = useQuery({
    queryKey: dmThreadQueryKey(threadId ?? undefined, userId),
    queryFn: () => fetchDmThreadBundle(threadId!, userId),
    enabled: Boolean(threadId && userId && isSupabaseConfigured()),
    staleTime: 20_000,
  });

  if (!threadId) return null;

  const peer = threadQuery.data?.peer ?? null;
  const peerLabel = peer?.label?.trim() || "Chat";
  const loadingPeer = threadQuery.isPending && !peer;
  const peerTyping = usePeerTypingActive(threadId);

  return (
    <header
      className="relative z-40 flex shrink-0 items-center gap-1 border-b border-border/40 bg-background/95 px-2 py-2 backdrop-blur-md [padding-left:max(0.5rem,env(safe-area-inset-left))] [padding-right:max(0.5rem,env(safe-area-inset-right))]"
      data-testid="dm-thread-subheader"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 rounded-full"
        aria-label="Back to messages"
        onClick={() => backFromDmThread(setLocation)}
        data-testid="dm-thread-back"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
      </Button>

      {peer ? (
        <Link
          href={`/community/profile/${encodeURIComponent(peer.userId)}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-0.5 pr-2 transition-colors active:bg-muted/50"
          data-testid="dm-thread-peer-link"
        >
          <CommunityAuthorAvatar
            size="sm"
            displayName={peerLabel}
            avatarPath={peer.avatarPath}
            profileHref={undefined}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-foreground" data-testid="dm-thread-peer-name">
              {peerLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {peerTyping ? (
                <span className="text-primary/80">Typing…</span>
              ) : (
                "View profile"
              )}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5">
          {loadingPeer ? <Skeleton className="h-8 w-8 shrink-0 rounded-full" /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-foreground" data-testid="dm-thread-peer-name">
              {peerLabel}
            </p>
            {loadingPeer ? <Skeleton className="mt-1 h-3 w-20 rounded-md" /> : null}
          </div>
        </div>
      )}
    </header>
  );
}
