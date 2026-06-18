import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, UserCheck, UserPlus } from "lucide-react";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { StoryAvatarRing } from "@/components/community/story-avatar-ring";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { useIsMobile } from "@/hooks/use-mobile";
import { type FollowSuggestion } from "@/lib/community";
import type { StoryRingState } from "@/lib/community/stories-supabase";
import { searchProfilesByHandlePrefix } from "@/lib/profile";

type FindPeoplePerson = {
  id: string;
  name: string;
  avatar_url: string | null;
  handle: string;
  reasonLabel?: string;
};

function preventDialogAutoFocus(e: Event) {
  e.preventDefault();
}

function FindPeoplePersonRow({
  person,
  alreadyFollowing,
  busy,
  waitFollowees,
  isSelf,
  hasUser,
  showReason,
  onFollow,
  storyRing,
  onStoryClick,
}: {
  person: FindPeoplePerson;
  alreadyFollowing: boolean;
  busy: boolean;
  waitFollowees: boolean;
  isSelf: boolean;
  hasUser: boolean;
  showReason?: boolean;
  onFollow: () => void;
  storyRing?: StoryRingState;
  onStoryClick?: () => void;
}) {
  const followLabel = !hasUser
    ? "Follow"
    : busy || (waitFollowees && !alreadyFollowing)
      ? "…"
      : alreadyFollowing
        ? "Following"
        : isSelf
          ? "You"
          : "Follow";

  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl border border-border/45 bg-card/60 px-3 py-2.5 shadow-sm">
        {storyRing && storyRing !== "none" && onStoryClick ? (
          <StoryAvatarRing
            state={storyRing}
            onClick={onStoryClick}
            label={`Watch ${person.name}'s story`}
          >
            <CommunityAuthorAvatar
              displayName={person.name}
              avatarPath={person.avatar_url}
              size="sm"
              profileHref={undefined}
            />
          </StoryAvatarRing>
        ) : (
          <Link
            href={`/community/profile/${encodeURIComponent(person.id)}`}
            className="shrink-0 active:opacity-80"
          >
            <CommunityAuthorAvatar
              displayName={person.name}
              avatarPath={person.avatar_url}
              size="sm"
              profileHref={undefined}
            />
          </Link>
        )}
        <Link
          href={`/community/profile/${encodeURIComponent(person.id)}`}
          className="flex min-w-0 flex-1 items-center gap-3 active:opacity-80"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{person.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{person.handle}</p>
            {showReason && person.reasonLabel ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/90">{person.reasonLabel}</p>
            ) : null}
          </div>
        </Link>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 rounded-full px-3 text-xs"
          variant={alreadyFollowing ? "secondary" : "default"}
          disabled={!hasUser || isSelf || busy || (waitFollowees && !alreadyFollowing) || alreadyFollowing}
          onClick={onFollow}
        >
          {alreadyFollowing ? (
            <UserCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
          ) : (
            <UserPlus className="mr-1 h-3.5 w-3.5" aria-hidden />
          )}
          {followLabel}
        </Button>
      </div>
    </li>
  );
}

function FindPeoplePersonSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/45 bg-card/60 px-3 py-2.5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
    </li>
  );
}

function FindPeoplePanelBody({
  userId,
  followeeIds,
  followeesLoading,
  followBusyIds,
  onFollow,
  query,
  onQueryChange,
  peopleLoading,
  peopleError,
  peopleResults,
  suggested,
  suggestedLoading,
  ringState,
  onStoryClick,
}: {
  userId: string | undefined;
  followeeIds: Set<string>;
  followeesLoading: boolean;
  followBusyIds: Record<string, boolean>;
  onFollow: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  peopleLoading: boolean;
  peopleError: string | null;
  peopleResults: FindPeoplePerson[];
  suggested: FollowSuggestion[];
  suggestedLoading: boolean;
  ringState: (authorId: string) => StoryRingState;
  onStoryClick?: (authorId: string) => void;
}) {
  const trimmed = query.trim();
  const searching = Boolean(trimmed);

  return (
    <>
      <div className="shrink-0 px-4 pb-3 pt-1 sm:px-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by @handle…"
            aria-label="Search people by handle"
            data-testid="input-find-people"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 rounded-2xl border-border/50 bg-muted/25 pl-10 text-[15px] shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {searching
            ? "Matching public handles as you type."
            : "Browse suggestions below, or search to find someone by @handle."}
        </p>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1 sm:px-6"
        data-testid="find-people-scroll"
      >
        {searching ? (
          <div className="space-y-2">
            {peopleLoading ? (
              <ul className="space-y-2" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => (
                  <FindPeoplePersonSkeleton key={i} />
                ))}
              </ul>
            ) : null}
            {peopleError ? <p className="px-1 text-sm text-destructive">{peopleError}</p> : null}
            {!peopleLoading && !peopleError && peopleResults.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No one found for @{trimmed.replace(/^@/, "")}. Check the spelling or try another handle.
              </p>
            ) : null}
            {peopleResults.length > 0 ? (
              <ul className="space-y-2">
                {peopleResults.map((p) => (
                  <FindPeoplePersonRow
                    key={p.id}
                    person={p}
                    isSelf={Boolean(userId && p.id === userId)}
                    alreadyFollowing={Boolean(userId && followeeIds.has(p.id))}
                    busy={Boolean(followBusyIds[p.id])}
                    waitFollowees={Boolean(userId && followeesLoading)}
                    hasUser={Boolean(userId)}
                    onFollow={() => onFollow(p.id)}
                    storyRing={ringState(p.id)}
                    onStoryClick={onStoryClick ? () => onStoryClick(p.id) : undefined}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-sm font-semibold text-foreground">Suggested for you</p>
              {suggestedLoading ? (
                <span className="text-xs text-muted-foreground">Loading…</span>
              ) : suggested.length > 0 ? (
                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {suggested.length}
                </span>
              ) : null}
            </div>
            {suggestedLoading ? (
              <ul className="space-y-2" aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <FindPeoplePersonSkeleton key={i} />
                ))}
              </ul>
            ) : suggested.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                No suggestions yet. Search by @handle above to find people.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggested.map((p) => (
                  <FindPeoplePersonRow
                    key={p.id}
                    person={{
                      id: p.id,
                      name: p.name,
                      avatar_url: p.avatar_url,
                      handle: p.handle,
                      reasonLabel: p.reasonLabel,
                    }}
                    showReason
                    isSelf={Boolean(userId && p.id === userId)}
                    alreadyFollowing={Boolean(userId && followeeIds.has(p.id))}
                    busy={Boolean(followBusyIds[p.id])}
                    waitFollowees={Boolean(userId && followeesLoading)}
                    hasUser={Boolean(userId)}
                    onFollow={() => onFollow(p.id)}
                    storyRing={ringState(p.id)}
                    onStoryClick={onStoryClick ? () => onStoryClick(p.id) : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

type FindPeoplePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  followeeIds: Set<string>;
  followeesLoading: boolean;
  followBusyIds: Record<string, boolean>;
  onFollow: (id: string) => void;
  suggested: FollowSuggestion[];
  suggestedLoading: boolean;
  onRefreshSuggested: () => void;
  onStoryClick?: (authorId: string) => void;
};

export function FindPeoplePanel({
  open,
  onOpenChange,
  userId,
  followeeIds,
  followeesLoading,
  followBusyIds,
  onFollow,
  suggested,
  suggestedLoading,
  onRefreshSuggested,
  onStoryClick,
}: FindPeoplePanelProps) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleResults, setPeopleResults] = useState<FindPeoplePerson[]>([]);

  const visibleAuthorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of peopleResults) ids.add(p.id);
    for (const p of suggested) ids.add(p.id);
    return [...ids];
  }, [peopleResults, suggested]);

  const { ringState } = useCommunityStories(userId, visibleAuthorIds);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPeopleLoading(false);
      setPeopleError(null);
      setPeopleResults([]);
      return;
    }
    onRefreshSuggested();
  }, [open, onRefreshSuggested]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const q = query.trim().replace(/^@/, "");
      if (!q) {
        setPeopleLoading(false);
        setPeopleError(null);
        setPeopleResults([]);
        return;
      }
      setPeopleLoading(true);
      setPeopleError(null);
      void searchProfilesByHandlePrefix(q, 12).then((res) => {
        setPeopleLoading(false);
        if (res.error) {
          setPeopleError(res.error.message);
          setPeopleResults([]);
          return;
        }
        const mapped = (res.data ?? [])
          .filter((p) => p.is_public === true)
          .filter((p) => p.id !== userId)
          .map((p) => ({
            id: p.id,
            name: p.full_name?.trim() || p.id.slice(0, 8),
            avatar_url: p.avatar_url ?? null,
            handle: (p.public_handle ?? "").trim(),
          }))
          .filter((p) => Boolean(p.handle));
        setPeopleResults(mapped);
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [open, query, userId]);

  const shellProps = {
    userId,
    followeeIds,
    followeesLoading,
    followBusyIds,
    onFollow,
    query,
    onQueryChange: setQuery,
    peopleLoading,
    peopleError,
    peopleResults,
    suggested,
    suggestedLoading,
    ringState,
    onStoryClick,
  };

  const title = "Find people";
  const description = "Follow others to see their posts in your Following feed.";

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        onOpenAutoFocus={preventDialogAutoFocus}
      >
        <FindPeoplePanelBody {...shellProps} />
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(85dvh,36rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md"
        onOpenAutoFocus={preventDialogAutoFocus}
      >
        <DialogHeader className="shrink-0 space-y-1 px-6 pb-2 pt-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FindPeoplePanelBody {...shellProps} />
      </DialogContent>
    </Dialog>
  );
}
