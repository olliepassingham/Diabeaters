import { useMemo, useState } from "react";
import { ChevronRight, Search, Users, X } from "lucide-react";
import { Link } from "wouter";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type FollowListPerson = {
  id: string;
  full_name: string;
  public_handle: string | null;
  avatar_url: string | null;
  /** Optional branded fallback when avatar_url is missing (e.g. Beatie bot). */
  fallbackSrc?: string | null;
};

export type FollowListKind = "followers" | "following";

type FollowListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: FollowListKind;
  people: FollowListPerson[];
  loading?: boolean;
  error?: string | null;
};

function preventDialogAutoFocus(e: Event) {
  e.preventDefault();
}

function kindCopy(kind: FollowListKind) {
  if (kind === "following") {
    return {
      title: "Following",
      description: "People this profile follows on the Feed.",
      empty: "Not following anyone yet.",
      emptyFilter: "No one in Following matches that search.",
    };
  }
  return {
    title: "Followers",
    description: "People who follow this profile on the Feed.",
    empty: "No followers yet.",
    emptyFilter: "No followers match that search.",
  };
}

function matchesQuery(person: FollowListPerson, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!q) return true;
  const name = person.full_name.trim().toLowerCase();
  const handle = (person.public_handle ?? "").trim().toLowerCase();
  return name.includes(q) || handle.includes(q);
}

function FollowListPersonSkeleton() {
  return (
    <li className="flex items-center gap-3 px-1 py-2.5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-36 max-w-[70%]" />
        <Skeleton className="h-3 w-24 max-w-[45%]" />
      </div>
    </li>
  );
}

function FollowListBody({
  kind,
  people,
  loading,
  error,
  onNavigate,
}: {
  kind: FollowListKind;
  people: FollowListPerson[];
  loading: boolean;
  error: string | null;
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState("");
  const copy = kindCopy(kind);
  const filtered = useMemo(() => people.filter((p) => matchesQuery(p, query)), [people, query]);
  const showSearch = !loading && !error && people.length >= 6;
  const countLabel =
    people.length === 1 ? "1 person" : `${people.length.toLocaleString()} people`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 px-4 pb-2 sm:px-6">
        {!loading && !error && people.length > 0 ? (
          <p className="text-xs font-medium tabular-nums text-muted-foreground">{countLabel}</p>
        ) : null}
        {showSearch ? (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @handle"
              aria-label={`Search ${copy.title.toLowerCase()}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 rounded-2xl border-border/50 bg-muted/25 pl-10 pr-10 text-[15px] shadow-sm"
            />
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Explicit max-height so overflow scrolls even when the sheet sizes to content. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-6 [-webkit-overflow-scrolling:touch] max-h-[min(68dvh,32rem)]"
        data-testid="follow-list-scroll"
      >
        {loading ? (
          <ul className="m-0 list-none space-y-0.5 p-0" aria-busy="true" aria-label="Loading list">
            {Array.from({ length: 6 }, (_, i) => (
              <FollowListPersonSkeleton key={i} />
            ))}
          </ul>
        ) : error ? (
          <p className="px-1 py-8 text-center text-sm text-destructive">{error}</p>
        ) : people.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">{copy.emptyFilter}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-border/50 p-0">
            {filtered.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/community/profile/${encodeURIComponent(row.id)}`}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-1 py-3 transition-colors",
                    "hover:bg-muted/50 active:bg-muted/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  )}
                >
                  <CommunityAuthorAvatar
                    displayName={row.full_name}
                    avatarPath={row.avatar_url}
                    size="md"
                    className="h-11 w-11"
                    fallbackSrc={row.fallbackSrc}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium leading-snug text-foreground">
                      {row.full_name}
                    </div>
                    {row.public_handle ? (
                      <div className="truncate text-sm text-muted-foreground">@{row.public_handle}</div>
                    ) : (
                      <div className="truncate text-sm text-muted-foreground/70">View profile</div>
                    )}
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Followers / Following picker. Uses a real bottom sheet on phones so the list
 * can scroll fully; desktop keeps a fixed-height dialog with the same body.
 */
export function FollowListDialog({
  open,
  onOpenChange,
  kind,
  people,
  loading = false,
  error = null,
}: FollowListDialogProps) {
  const isMobile = useIsMobile();
  const copy = kindCopy(kind);
  const bodyKey = `${kind}-${open ? "open" : "closed"}-${people.length}-${loading ? "1" : "0"}`;

  const body = (
    <FollowListBody
      key={bodyKey}
      kind={kind}
      people={people}
      loading={loading}
      error={error}
      onNavigate={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={copy.title}
        description={copy.description}
        className="max-h-[min(92dvh,720px)]"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        onOpenAutoFocus={preventDialogAutoFocus}
      >
        {body}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} mobileSheet={false}>
      <DialogContent
        className="flex max-h-[min(85dvh,36rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md"
        onOpenAutoFocus={preventDialogAutoFocus}
      >
        <DialogHeader className="shrink-0 space-y-1 px-6 pb-2 pt-6 text-left">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
