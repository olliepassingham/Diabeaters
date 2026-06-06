import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useRoute } from "wouter";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { dmThreadQueryKey, fetchDmThreadBundle } from "@/lib/dm-thread-query";
import { usePeerTypingActive } from "@/lib/dm-thread-typing";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Conversation chrome below AppTopBar: back to inbox + peer name/avatar.
 */
export function DmThreadSubheader() {
  const [match, params] = useRoute("/community/messages/:threadId");
  const threadId = match && params?.threadId ? params.threadId : null;
  const { user } = useAuth();
  const userId = user?.id ?? "";

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
      className="relative z-40 flex shrink-0 items-center gap-1 border-b border-border/50 bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-md [padding-left:max(0.5rem,env(safe-area-inset-left))] [padding-right:max(0.5rem,env(safe-area-inset-right))]"
      data-testid="dm-thread-subheader"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        aria-label="Back to messages"
        asChild
      >
        <Link href="/community/messages" data-testid="dm-thread-back">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </Link>
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
