import { Link } from "wouter";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { type FollowSuggestion } from "@/lib/community";
import { cn } from "@/lib/utils";

type Props = {
  suggestions: FollowSuggestion[];
  loading: boolean;
  followeeIds: Set<string>;
  followBusyIds: Record<string, boolean>;
  onFollow: (userId: string) => void;
  onFindPeople?: () => void;
  onDismiss?: () => void;
  className?: string;
};

export function FeedFollowSuggestionsStrip({
  suggestions,
  loading,
  followeeIds,
  followBusyIds,
  onFollow,
  onFindPeople,
  onDismiss,
  className,
}: Props) {
  if (!loading && suggestions.length === 0) return null;

  const visible = suggestions.slice(0, 10);

  return (
    <section
      className={cn(
        "animate-soft-in overflow-hidden rounded-2xl border border-border/45 bg-gradient-to-b from-muted/30 to-card/70 px-3 py-3 shadow-sm ring-1 ring-border/25",
        className,
      )}
      data-testid="feed-follow-suggestions-strip"
      aria-label="Suggested people to follow"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-foreground">People to follow</p>
        <div className="flex items-center gap-0.5">
          {onFindPeople ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onFindPeople}>
              See all
            </Button>
          ) : null}
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={onDismiss}
              aria-label="Hide suggested people"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="flex w-[9.5rem] shrink-0 snap-start flex-col items-center gap-2 rounded-xl border border-border/35 bg-background/50 px-2.5 py-3"
              >
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-full rounded-full" />
              </div>
            ))
          : visible.map((person) => {
              const alreadyFollowing = followeeIds.has(person.id);
              const busy = Boolean(followBusyIds[person.id]);
              return (
                <div
                  key={person.id}
                  className="flex w-[9.5rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5 py-3 text-center shadow-sm"
                >
                  <Link href={`/community/profile/${encodeURIComponent(person.id)}`} className="flex flex-col items-center gap-1.5">
                    <CommunityAuthorAvatar
                      displayName={person.name}
                      avatarPath={person.avatar_url}
                      size="md"
                      className="!h-14 !w-14 ring-2 ring-background"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-xs font-semibold leading-tight text-foreground">{person.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">@{person.handle}</p>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 w-full rounded-full text-[11px]"
                    variant={alreadyFollowing ? "secondary" : "default"}
                    disabled={alreadyFollowing || busy}
                    onClick={() => onFollow(person.id)}
                  >
                    {alreadyFollowing ? "Following" : busy ? "…" : "Follow"}
                  </Button>
                </div>
              );
            })}
      </div>
    </section>
  );
}
