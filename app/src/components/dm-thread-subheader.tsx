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
 * Full conversation header for DM threads (replaces AppTopBar on this route).
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
      className="surface-chrome relative z-50 shrink-0 border-b border-border/40 bg-background/90 backdrop-blur-xl pt-[env(safe-area-inset-top)] [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]"
      data-testid="dm-thread-subheader"
    >
      <div className="flex min-h-[3.25rem] items-center gap-1 px-1 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-foreground"
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
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pr-3 transition-colors active:bg-muted/50"
            data-testid="dm-thread-peer-link"
          >
            <CommunityAuthorAvatar
              size="md"
              displayName={peerLabel}
              avatarPath={peer.avatarPath}
              profileHref={undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold leading-tight text-foreground" data-testid="dm-thread-peer-name">
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
          <div className="flex min-w-0 flex-1 items-center gap-3 py-1">
            {loadingPeer ? <Skeleton className="h-11 w-11 shrink-0 rounded-full" /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold leading-tight text-foreground" data-testid="dm-thread-peer-name">
                {peerLabel}
              </p>
              {loadingPeer ? <Skeleton className="mt-1.5 h-3 w-20 rounded-md" /> : null}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
