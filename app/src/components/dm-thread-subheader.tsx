import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useRoute } from "wouter";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { dmThreadQueryKey, fetchDmThreadBundle } from "@/lib/dm-thread-query";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Conversation chrome below AppTopBar: back to inbox + peer name/avatar.
 * Lives in document flow (not inside the fixed chat pane) so it stays visible on phone.
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

  return (
    <header
      className="relative z-40 flex shrink-0 items-center gap-2 border-b border-border/60 bg-background px-2 py-2 shadow-sm [padding-left:max(0.5rem,env(safe-area-inset-left))] [padding-right:max(0.5rem,env(safe-area-inset-right))]"
      data-testid="dm-thread-subheader"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 rounded-full"
        aria-label="Back to messages"
        asChild
      >
        <Link href="/community/messages" data-testid="dm-thread-back">
          <ChevronLeft className="h-6 w-6" />
        </Link>
      </Button>
      {peer ? (
        <Link
          href={`/community/profile/${encodeURIComponent(peer.userId)}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-2 transition-colors hover:bg-muted/40"
          data-testid="dm-thread-peer-link"
        >
          <CommunityAuthorAvatar
            size="sm"
            displayName={peerLabel}
            avatarPath={peer.avatarPath}
            profileHref={undefined}
          />
          <span className="truncate text-base font-semibold text-foreground">{peerLabel}</span>
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 py-1">
          {loadingPeer ? <Skeleton className="h-9 w-9 shrink-0 rounded-full" /> : null}
          <span className="truncate text-base font-semibold text-foreground" data-testid="dm-thread-peer-name">
            {peerLabel}
          </span>
        </div>
      )}
    </header>
  );
}
