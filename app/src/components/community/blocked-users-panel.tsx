import { useCallback, useEffect, useState } from "react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { listUsersBlockedByCurrentUser, unblockUser } from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type BlockedProfile = {
  id: string;
  full_name: string;
  public_handle: string | null;
  avatar_url: string | null;
};

type BlockedUsersPanelProps = {
  /** When false, skip loading (e.g. sheet closed). */
  active?: boolean;
};

export function BlockedUsersPanel({ active = true }: BlockedUsersPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BlockedProfile[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    const { ids, error } = await listUsersBlockedByCurrentUser();
    if (error) {
      setRows([]);
      setLoading(false);
      toast({ title: "Could not load blocked users", description: error.message, variant: "destructive" });
      return;
    }
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const map = await getProfilesByIds(ids);
    setRows(
      ids.map((id) => {
        const profile = map.get(id);
        return {
          id,
          full_name: profile?.full_name?.trim() || shortId(id),
          public_handle: profile?.public_handle?.trim() || null,
          avatar_url: profile?.avatar_url ?? null,
        };
      }),
    );
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!active) return;
    void loadBlocked();
  }, [active, loadBlocked]);

  async function handleUnblock(blockedId: string) {
    setUnblockingId(blockedId);
    const { error } = await unblockUser(blockedId);
    setUnblockingId(null);
    if (error) {
      toast({ title: "Unblock failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== blockedId));
    toast({ title: "Unblocked", description: "You can see each other's posts and message again." });
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" data-testid="feed-blocked-users-loading">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="feed-blocked-users-empty">
        You haven&apos;t blocked anyone.
      </p>
    );
  }

  return (
    <ul
      className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden bg-card m-0 list-none p-0"
      data-testid="feed-blocked-users-list"
    >
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-3 py-3">
          <CommunityAuthorAvatar displayName={row.full_name} avatarPath={row.avatar_url} size="sm" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{row.full_name}</div>
            {row.public_handle ? (
              <div className="text-xs text-muted-foreground truncate">@{row.public_handle}</div>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 rounded-full"
            disabled={unblockingId === row.id}
            onClick={() => void handleUnblock(row.id)}
            data-testid={`unblock-user-${row.id}`}
          >
            {unblockingId === row.id ? "Unblocking…" : "Unblock"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
